type SetupIconProps = {
  complete: boolean;
  step: 1 | 2 | 3;
};

export function SetupIcon({ complete, step }: SetupIconProps) {
  if (!complete) {
    return (
      <span
        className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-[0.6875rem] font-[650] text-white shadow-[0_1px_2px_rgb(0_0_0_/_0.16)]"
        aria-hidden="true"
      >
        <span>{step}</span>
      </span>
    );
  }

  return (
    <span
      className="grid size-7 shrink-0 place-items-center rounded-full border border-black/12 bg-black/[0.055] text-[0.6875rem] font-[650] text-black/[0.62]"
      aria-hidden="true"
    >
      <svg viewBox="0 0 20 20" fill="none" className="size-3.5">
        <path d="m5 10.5 3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
