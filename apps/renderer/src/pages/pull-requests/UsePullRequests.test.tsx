// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import type { PullRequestGroup } from "@review/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { configureQueryFocusManager } from "../../Query/QueryFocusManager";
import { usePullRequests } from "./use-pull-requests";

const groups: PullRequestGroup[] = [{
  pullRequests: [],
  repository: "owner/repository",
  state: "ready",
}];
const repositories = ["owner/repository"];

function TestQueryProvider({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("usePullRequests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  test("refreshes pull requests every 60 seconds", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const listPullRequests = vi.fn(async () => groups);
    Object.defineProperty(window, "reviewDesktop", {
      configurable: true,
      value: { listPullRequests },
    });

    renderHook(() => usePullRequests(repositories), { wrapper: TestQueryProvider });
    await act(async () => undefined);
    expect(listPullRequests).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(60_000));

    expect(listPullRequests).toHaveBeenCalledTimes(2);
  });

  test("refreshes on focus only when data is older than 30 seconds", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2026-09-03T12:00:00Z"));
    configureQueryFocusManager();
    const listPullRequests = vi.fn(async () => groups);
    Object.defineProperty(window, "reviewDesktop", {
      configurable: true,
      value: { listPullRequests },
    });

    renderHook(() => usePullRequests(repositories), { wrapper: TestQueryProvider });
    await act(async () => undefined);
    expect(listPullRequests).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("blur"));
    vi.setSystemTime(new Date("2026-09-03T12:00:29Z"));
    window.dispatchEvent(new Event("focus"));
    await act(async () => undefined);
    expect(listPullRequests).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("blur"));
    vi.setSystemTime(new Date("2026-09-03T12:00:31Z"));
    window.dispatchEvent(new Event("focus"));
    await act(async () => undefined);

    expect(listPullRequests).toHaveBeenCalledTimes(2);
  });

  test("pauses polling while the app is hidden", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let visibilityState: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibilityState);
    configureQueryFocusManager();
    const listPullRequests = vi.fn(async () => groups);
    Object.defineProperty(window, "reviewDesktop", {
      configurable: true,
      value: { listPullRequests },
    });

    renderHook(() => usePullRequests(repositories), { wrapper: TestQueryProvider });
    await act(async () => undefined);
    expect(listPullRequests).toHaveBeenCalledTimes(1);

    visibilityState = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    await act(async () => vi.advanceTimersByTimeAsync(60_000));

    expect(listPullRequests).toHaveBeenCalledTimes(1);
  });

  test("keeps current data visible during a background refresh", async () => {
    let finishRefresh: ((value: PullRequestGroup[]) => void) | undefined;
    const pendingRefresh = new Promise<PullRequestGroup[]>((resolve) => {
      finishRefresh = resolve;
    });
    const listPullRequests = vi.fn()
      .mockResolvedValueOnce(groups)
      .mockReturnValueOnce(pendingRefresh);
    Object.defineProperty(window, "reviewDesktop", {
      configurable: true,
      value: { listPullRequests },
    });

    const { result } = renderHook(
      () => usePullRequests(repositories),
      { wrapper: TestQueryProvider },
    );
    await waitFor(() => expect(result.current.groups).toEqual(groups));

    act(() => {
      void result.current.refresh();
    });
    await waitFor(() => expect(listPullRequests).toHaveBeenCalledTimes(2));

    expect(result.current.groups).toEqual(groups);
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);

    await act(async () => finishRefresh?.(groups));
  });
});
