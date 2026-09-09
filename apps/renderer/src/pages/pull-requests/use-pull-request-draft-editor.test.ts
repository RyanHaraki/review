// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type { PullRequestDraft, SavePullRequestDraft } from "@review/contracts";
import { afterEach, expect, test, vi } from "vitest";
import { usePullRequestDraftEditor } from "./use-pull-request-draft-editor";

function saved(input: SavePullRequestDraft): PullRequestDraft {
  return { id: input.id, key: input.key, target: input.target, body: input.body, revision: input.expectedRevision + 1, updatedAt: new Date().toISOString(), status: "draft", error: null, remoteUrl: null };
}
afterEach(() => vi.unstubAllGlobals());

test("saves every edit in order after unmount and submits only the last saved revision", async () => {
  const first = Promise.withResolvers<PullRequestDraft>();
  const writes: SavePullRequestDraft[] = [];
  const submissions: number[] = [];
  vi.stubGlobal("window", { reviewDesktop: {
    savePullRequestDraft(input: SavePullRequestDraft) {
      writes.push(input);
      return writes.length === 1 ? first.promise : Promise.resolve(saved(input));
    },
    async submitPullRequestDraft(input: { revision: number }) {
      submissions.push(input.revision);
      const latest = writes.at(-1);
      if (!latest) throw new Error("Missing save");
      return { ...saved(latest), status: "submitted" };
    },
  } });
  const hook = renderHook(() => usePullRequestDraftEditor({ pullRequestKey: { repository: "owner/repo", number: 2 }, target: { kind: "discussion" } }));
  const editor = hook.result.current;
  act(() => { editor.save("a"); editor.save("ab"); });
  hook.unmount();
  await Promise.resolve();
  expect(writes).toHaveLength(1);
  const firstWrite = writes[0];
  if (!firstWrite) throw new Error("Missing first write");
  const submission = editor.submit();
  expect(submissions).toEqual([]);
  first.resolve(saved(firstWrite));
  expect(await submission).toBe(true);
  expect(writes.map((write) => [write.body, write.expectedRevision])).toEqual([["a", 0], ["ab", 1]]);
  expect(submissions).toEqual([2]);
});

test("editing a second PR does not change the first PR's queued writes", async () => {
  const writes: SavePullRequestDraft[] = [];
  vi.stubGlobal("window", { reviewDesktop: { async savePullRequestDraft(input: SavePullRequestDraft) { writes.push(input); return saved(input); } } });
  const first = renderHook(() => usePullRequestDraftEditor({ pullRequestKey: { repository: "owner/repo", number: 1 }, target: { kind: "discussion" } }));
  act(() => first.result.current.save("first PR"));
  first.unmount();
  const second = renderHook(() => usePullRequestDraftEditor({ pullRequestKey: { repository: "owner/repo", number: 2 }, target: { kind: "discussion" } }));
  await act(async () => { second.result.current.save("second PR"); await Promise.resolve(); });
  expect(writes.map((write) => [write.key.number, write.body])).toEqual([[1, "first PR"], [2, "second PR"]]);
  second.unmount();
});

test("remount uses the same queue and keeps text newer than the restored SQLite row", async () => {
  const pending = Promise.withResolvers<PullRequestDraft>();
  const writes: SavePullRequestDraft[] = [];
  vi.stubGlobal("window", { reviewDesktop: { async savePullRequestDraft(input: SavePullRequestDraft) { writes.push(input); return writes.length === 2 ? pending.promise : saved(input); } } });
  const first = renderHook(() => usePullRequestDraftEditor({ pullRequestKey: { repository: "owner/repo", number: 3 }, target: { kind: "discussion" } }));
  await act(async () => first.result.current.save("saved text"));
  const restored = first.result.current.draft;
  if (!restored) throw new Error("Missing persisted draft");
  act(() => first.result.current.save("newer text"));
  first.unmount();
  const second = renderHook(() => usePullRequestDraftEditor({ pullRequestKey: restored.key, target: restored.target, draft: restored }));
  expect(second.result.current.body).toBe("newer text");
  await act(async () => {
    second.result.current.save("newest text");
    await Promise.resolve();
    const secondWrite = writes[1];
    if (!secondWrite) throw new Error("Missing pending save");
    pending.resolve(saved(secondWrite));
  });
  expect(writes.map((write) => write.expectedRevision)).toEqual([0, 1, 2]);
  expect(second.result.current.draft?.body).toBe("newest text");
  second.unmount();
});

test("recovers a lost save response and continues the next edit from the persisted revision", async () => {
  const writes: SavePullRequestDraft[] = [];
  let persisted: PullRequestDraft | undefined;
  vi.stubGlobal("window", { reviewDesktop: {
    async savePullRequestDraft(input: SavePullRequestDraft) {
      writes.push(input);
      persisted = saved(input);
      if (writes.length === 1) throw new Error("IPC response lost");
      return persisted;
    },
    async listPullRequestDrafts() { return persisted ? [persisted] : []; },
  } });
  const hook = renderHook(() => usePullRequestDraftEditor({ pullRequestKey: { repository: "owner/repo", number: 4 }, target: { kind: "discussion" } }));
  await act(async () => { hook.result.current.save("first text"); hook.result.current.save("newer text"); });
  expect(writes.map((write) => [write.body, write.expectedRevision])).toEqual([["first text", 0], ["newer text", 1]]);
  expect(hook.result.current.body).toBe("newer text");
  expect(hook.result.current.draft?.revision).toBe(2);
  expect(hook.result.current.error).toBeNull();
  hook.unmount();
});

test("does not adopt a competing saved body after a failed save", async () => {
  let competing: PullRequestDraft | undefined;
  vi.stubGlobal("window", { reviewDesktop: {
    async savePullRequestDraft(input: SavePullRequestDraft) { competing = { ...saved(input), body: "another editor" }; throw new Error("Revision conflict"); },
    async listPullRequestDrafts() { return competing ? [competing] : []; },
  } });
  const hook = renderHook(() => usePullRequestDraftEditor({ pullRequestKey: { repository: "owner/repo", number: 5 }, target: { kind: "discussion" } }));
  await act(async () => hook.result.current.save("my text"));
  expect(hook.result.current.body).toBe("my text");
  expect(hook.result.current.draft).toBeUndefined();
  expect(hook.result.current.error).toBe("Revision conflict");
  hook.unmount();
});
