export function PullRequestWorkspaceSkeleton() {
  return (
    <div aria-label="Loading pull requests" className="flex h-[calc(100vh-2.125rem)]" role="status">
      <div className="w-88 shrink-0 border-e border-border bg-panel p-4">
        <div className="h-7 w-32 animate-pulse rounded bg-surface-selected" />
        <div className="mt-4 flex gap-2">
          <div className="h-7 w-30 animate-pulse rounded bg-surface-selected" />
          <div className="h-7 w-30 animate-pulse rounded bg-surface-selected" />
        </div>
        <div className="mt-6 grid gap-2">
          {[0, 1, 2, 3, 4].map((row) => (
            <div className="h-14 animate-pulse rounded-lg bg-surface-selected" key={row} />
          ))}
        </div>
      </div>
      <div className="flex-1 p-8">
        <div className="h-8 w-1/2 animate-pulse rounded bg-surface-selected" />
        <div className="mt-4 h-4 w-1/3 animate-pulse rounded bg-surface-selected" />
      </div>
    </div>
  );
}
