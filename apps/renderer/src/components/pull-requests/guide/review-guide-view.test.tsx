// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { GuideState } from "@review/contracts";

import { ReviewGuideView } from "./review-guide-view";

const state: GuideState = {
  kind: "ready",
  guide: {
    generatedAt: "2026-09-17T00:00:00Z",
    chapters: [
      { title: "Save drafts", explanation: "Drafts survive restarts.", filePaths: ["drafts.ts", "storage.ts"] },
      { title: "Show drafts", explanation: "Open saved drafts in the editor.", filePaths: ["editor.tsx"] },
    ],
    generatedFiles: [],
    files: ["drafts.ts", "storage.ts", "editor.tsx"].map((path) => ({
      path, previousPath: null, status: "modified", additions: 1, deletions: 1, patch: null,
    })),
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("reveals the explanation before mounting diffs, then adds files in order", () => {
  const view = render(<ReviewGuideView state={{ kind: "generating", startedAt: "now" }} error={null} loading={false} retry={vi.fn()} reveal />);
  expect(screen.getByText("Loading review")).toBeDefined();
  view.rerender(<ReviewGuideView state={state} error={null} loading={false} retry={vi.fn()} reveal />);
  expect(screen.getByText("Drafts survive restarts.")).toBeDefined();
  expect(screen.queryByRole("button", { name: /drafts.ts/ })).toBeNull();
  expect(screen.queryByText("Show drafts")).toBeNull();
  act(() => vi.advanceTimersByTime(60));
  expect(screen.getByRole("button", { name: /drafts.ts/ })).toBeDefined();
  expect(screen.queryByRole("button", { name: /storage.ts/ })).toBeNull();
  for (let tick = 0; tick < 30; tick += 1) act(() => vi.advanceTimersByTime(60));
  expect(screen.getByRole("button", { name: /editor.tsx/ })).toBeDefined();
});

test("shows cached guides in full without a reveal", () => {
  render(<ReviewGuideView state={state} error={null} loading={false} retry={vi.fn()} reveal={false} />);
  expect(screen.getAllByRole("button")).toHaveLength(3);
  expect(document.querySelector(".guide-reveal")).toBeNull();
});

test("shows all content immediately when reduced motion is enabled", () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
  render(<ReviewGuideView state={state} error={null} loading={false} retry={vi.fn()} reveal />);
  expect(screen.getAllByRole("button")).toHaveLength(3);
  expect(document.querySelector(".guide-reveal")).toBeNull();
});
