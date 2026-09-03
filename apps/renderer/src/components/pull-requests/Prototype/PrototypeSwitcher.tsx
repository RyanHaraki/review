import { useCallback, useEffect } from "react";

import { Button } from "../../ui/button";

export type PrototypeVariant = "A" | "B" | "C";

const variants: Array<{ label: string; value: PrototypeVariant }> = [
  { label: "Grouped list", value: "A" },
  { label: "Compact queue", value: "B" },
  { label: "Review inbox", value: "C" },
];

type PrototypeSwitcherProps = {
  onChange(variant: PrototypeVariant): void;
  value: PrototypeVariant;
};

export function PrototypeSwitcher({ onChange, value }: PrototypeSwitcherProps) {
  const currentIndex = variants.findIndex((variant) => variant.value === value);
  const selectOffset = useCallback((offset: number) => {
    const nextIndex = (currentIndex + offset + variants.length) % variants.length;
    const nextVariant = variants[nextIndex];
    if (nextVariant) {
      onChange(nextVariant.value);
    }
  }, [currentIndex, onChange]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || (target instanceof HTMLElement && target.isContentEditable)) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        selectOffset(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        selectOffset(1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectOffset]);

  if (import.meta.env.PROD) {
    return null;
  }

  const currentVariant = variants[currentIndex] ?? variants[0];

  return (
    <div
      aria-label="Layout prototype variants"
      className="fixed inset-x-0 bottom-5 z-50 mx-auto flex w-fit items-center gap-2 rounded-full border border-border-strong bg-accent p-1.5 text-white shadow-[0_12px_32px_rgb(0_0_0_/_0.22)]"
      role="group"
    >
      <Button
        aria-label="Previous layout"
        className="text-white focus-visible:outline-white"
        onClick={() => selectOffset(-1)}
        size="icon-sm"
        variant="ghost"
      >
        <span aria-hidden="true">←</span>
      </Button>
      <span className="min-w-32 px-2 text-center text-xs font-medium">
        {currentVariant?.value}. {currentVariant?.label}
      </span>
      <Button
        aria-label="Next layout"
        className="text-white focus-visible:outline-white"
        onClick={() => selectOffset(1)}
        size="icon-sm"
        variant="ghost"
      >
        <span aria-hidden="true">→</span>
      </Button>
    </div>
  );
}
