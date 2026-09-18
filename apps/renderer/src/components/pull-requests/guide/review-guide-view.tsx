import type { GuideState } from "@review/contracts";

import { Button } from "../../ui/button";
import { GuideLoading } from "./guide-loading";
import { ReviewGuideContent } from "./review-guide-content";

export function ReviewGuideView({ state, error, loading, retry, reveal }: {
  state: GuideState | undefined;
  error: string | null | undefined;
  loading: boolean;
  retry(): void;
  reveal: boolean;
}) {
  const guide = state?.kind === "ready" ? state.guide : null;
  const message = error ?? (state?.kind === "failed" ? state.message : null);
  if (message && !loading) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center gap-4 text-center" role="alert">
        <p className="max-w-md text-sm text-text-secondary">{message}</p>
        <Button onClick={retry} variant="outline">Retry</Button>
      </div>
    );
  }
  if (!guide || loading) return <GuideLoading />;
  return <ReviewGuideContent guide={guide} key={guide.generatedAt} reveal={reveal} />;
}
