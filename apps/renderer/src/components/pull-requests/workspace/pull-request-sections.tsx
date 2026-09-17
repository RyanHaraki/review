import { lazy, Suspense, useCallback, useMemo } from "react";
import type { PullRequestSummary } from "@review/contracts";
import { z } from "zod";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { ReviewGuideView } from "../guide/review-guide-view";
import { useReviewGuide } from "../guide/use-review-guide";
import { PullRequestOverview } from "./pull-request-overview";

const PullRequestDiffs = lazy(() => import("./pull-request-diffs").then((module) => ({ default: module.PullRequestDiffs })));
const reviewTabSchema = z.enum(["overview", "diffs", "guide"]);

export function PullRequestSections({ pullRequest, tab, onTabChange }: {
  pullRequest: PullRequestSummary;
  tab: string;
  onTabChange(tab: string): void;
}) {
  const key = useMemo(() => ({
    repository: pullRequest.repository,
    number: pullRequest.number,
    baseSha: pullRequest.baseSha,
    headSha: pullRequest.headSha,
  }), [pullRequest.repository, pullRequest.number, pullRequest.baseSha, pullRequest.headSha]);
  const guide = useReviewGuide(key, tab === "guide");
  const { open } = guide;
  const changeTab = useCallback((value: string | number | null) => {
    const selected = reviewTabSchema.parse(value);
    onTabChange(selected);
    if (selected === "guide") void open();
  }, [onTabChange, open]);
  return (
    <Tabs className="mt-6" onValueChange={changeTab} value={tab}>
      <TabsList aria-label="Pull request sections">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="diffs">Diffs</TabsTrigger>
        <TabsTrigger value="guide">Guide</TabsTrigger>
      </TabsList>
      <TabsContent className="pt-4" value="overview">
        <PullRequestOverview pullRequestKey={key} />
      </TabsContent>
      <TabsContent className="pt-4" value="diffs">
        <Suspense fallback={<p className="py-12 text-sm text-text-secondary" role="status">Loading diff viewer…</p>}>
          <PullRequestDiffs pullRequestKey={key} />
        </Suspense>
      </TabsContent>
      <TabsContent className="pt-4" value="guide">
        <ReviewGuideView {...guide} />
      </TabsContent>
    </Tabs>
  );
}
