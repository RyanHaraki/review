export function SetupProgress({ completedSteps }: { completedSteps: number }) {
  const className = completedSteps === 3
    ? "size-3.5 rounded-full [--setup-progress:100%] [background:conic-gradient(var(--color-status-complete)_var(--setup-progress),rgb(0_0_0_/_0.12)_0)] [mask:radial-gradient(circle,transparent_44%,black_47%)]"
    : completedSteps === 2
      ? "size-3.5 rounded-full [--setup-progress:66.667%] [background:conic-gradient(var(--color-status-complete)_var(--setup-progress),rgb(0_0_0_/_0.12)_0)] [mask:radial-gradient(circle,transparent_44%,black_47%)]"
      : completedSteps === 1
        ? "size-3.5 rounded-full [--setup-progress:33.333%] [background:conic-gradient(var(--color-status-complete)_var(--setup-progress),rgb(0_0_0_/_0.12)_0)] [mask:radial-gradient(circle,transparent_44%,black_47%)]"
        : "size-3.5 rounded-full [--setup-progress:0%] [background:conic-gradient(var(--color-status-complete)_var(--setup-progress),rgb(0_0_0_/_0.12)_0)] [mask:radial-gradient(circle,transparent_44%,black_47%)]";

  return <span aria-hidden="true" className={className} />;
}
