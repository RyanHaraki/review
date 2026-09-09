import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FileReviewKey } from "@review/contracts";

export function useReviewedFiles(input: FileReviewKey) {
  const client = useQueryClient();
  const queryKey = ["reviewed-files", input.key.repository, input.key.number, input.baseSha, input.headSha];
  const query = useQuery({ queryKey, queryFn: () => window.reviewDesktop.readReviewedFiles(input) });
  const mutation = useMutation({
    mutationFn: ({ path, reviewed }: { path: string; reviewed: boolean }) => window.reviewDesktop.setFileReviewed({ ...input, path, reviewed }),
    onSuccess: (_result, { path, reviewed }) => {
      client.setQueryData<string[]>(queryKey, (current = []) => reviewed ? [...new Set([...current, path])] : current.filter((entry) => entry !== path));
    },
  });
  const { mutate } = mutation;
  const toggle = useCallback((path: string, reviewed: boolean) => mutate({ path, reviewed }), [mutate]);
  return { paths: query.data ?? [], toggle, pending: mutation.isPending || query.isPending, error: query.error ?? mutation.error };
}
