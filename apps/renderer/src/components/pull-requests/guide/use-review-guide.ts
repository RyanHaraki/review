import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GuideKey } from "@review/contracts";

export function useReviewGuide(key: GuideKey, active: boolean) {
  const queryClient = useQueryClient();
  const [reveal, setReveal] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const queryKey = useMemo(() => ["reviewGuide", key.repository, key.number, key.baseSha, key.headSha], [key]);
  const read = useCallback(() => window.reviewDesktop.readReviewGuide(key), [key]);
  const query = useQuery({
    queryKey,
    queryFn: read,
    enabled: active,
    refetchInterval: (current) => current.state.data?.kind === "generating" ? 750 : false,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const generate = useCallback(() => window.reviewDesktop.generateReviewGuide(key), [key]);
  const mutation = useMutation({
    mutationFn: generate,
    onSuccess(state) {
      setReveal(state.kind === "generating");
      queryClient.setQueryData(queryKey, state);
    },
  });
  const { mutate, reset } = mutation;
  const retry = useCallback(() => {
    setOpenError(null);
    mutate();
  }, [mutate]);
  const open = useCallback(async () => {
    setReveal(false);
    setOpenError(null);
    reset();
    try {
      const state = await queryClient.fetchQuery({ queryKey, queryFn: read, staleTime: 0 });
      if (state.kind === "missing") mutate();
      else setReveal(state.kind === "generating");
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : "Unable to load the guide.");
    }
  }, [mutate, queryClient, queryKey, read, reset]);
  return {
    state: query.data,
    error: openError ?? mutation.error?.message ?? query.error?.message,
    loading: query.isPending || mutation.isPending,
    open,
    retry,
    reveal,
  };
}
