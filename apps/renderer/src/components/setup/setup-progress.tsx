export function SetupProgress({ completedSteps }: { completedSteps: number }) {
  const progress = ["[--setup-progress:0%]", "[--setup-progress:25%]", "[--setup-progress:50%]", "[--setup-progress:75%]", "[--setup-progress:100%]"][completedSteps];
  const className = `size-3.5 rounded-full ${progress} [background:conic-gradient(var(--color-status-complete)_var(--setup-progress),rgb(0_0_0_/_0.12)_0)] [mask:radial-gradient(circle,transparent_44%,black_47%)]`;

  return <span aria-hidden="true" className={className} />;
}
