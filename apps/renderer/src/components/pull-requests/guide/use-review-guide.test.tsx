// @vitest-environment jsdom
import { createElement, type PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";
import type { GuideState } from "@review/contracts";
import { useReviewGuide } from "./use-review-guide";

const key = { repository: "example/review", number: 1, baseSha: "a".repeat(40), headSha: "b".repeat(40) };

describe("guide activation", () => {
  test("starts only after Guide is opened and reuses a completed guide without a reveal", async () => {
    let saved: GuideState = { kind: "missing" };
    const readReviewGuide = vi.fn(async () => saved);
    const generateReviewGuide = vi.fn(async (): Promise<GuideState> => {
      saved = { kind: "generating", startedAt: new Date().toISOString() };
      return saved;
    });
    Object.defineProperty(window, "reviewDesktop", { configurable: true, value: { readReviewGuide, generateReviewGuide } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => createElement(QueryClientProvider, { client }, children);
    const hook = renderHook(({ active }) => useReviewGuide(key, active), { wrapper, initialProps: { active: false } });
    expect(readReviewGuide).not.toHaveBeenCalled();
    expect(generateReviewGuide).not.toHaveBeenCalled();
    await act(async () => hook.result.current.open());
    hook.rerender({ active: true });
    await waitFor(() => expect(hook.result.current.state?.kind).toBe("generating"));
    expect(generateReviewGuide).toHaveBeenCalledTimes(1);
    saved = { kind: "ready", guide: { chapters: [], generatedFiles: [], files: [], generatedAt: new Date().toISOString() } };
    await waitFor(() => expect(hook.result.current.state?.kind).toBe("ready"), { timeout: 2500 });
    expect(hook.result.current.reveal).toBe(true);
    hook.rerender({ active: false });
    await act(async () => hook.result.current.open());
    expect(hook.result.current.reveal).toBe(false);
    expect(generateReviewGuide).toHaveBeenCalledTimes(1);
    hook.unmount();
    client.clear();
  });
});
