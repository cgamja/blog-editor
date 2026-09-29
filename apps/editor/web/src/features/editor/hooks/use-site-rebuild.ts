import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSiteRebuild, retrySiteRebuild } from "../api";
import { SITE_REBUILD_POLL_MS, SITE_REBUILD_QUERY_KEY } from "../constants";
import type { SiteRebuildState } from "../types";

/**
 * 편집 화면의 사이트 반영 상태(openspec site-rebuild). 서버가 30초 묶어 훅을 부르므로 pending인 동안만
 * 다시 읽는다. 읽지 못하면 띠를 띄우지 않을 뿐이다 — 편집을 막지 않는다.
 */
export function useSiteRebuild() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: SITE_REBUILD_QUERY_KEY,
    queryFn: fetchSiteRebuild,
    refetchInterval: ({ state }) =>
      state.data?.status === "pending" ? SITE_REBUILD_POLL_MS : false,
  });
  const mutation = useMutation({
    mutationFn: retrySiteRebuild,
    onSuccess: (state: SiteRebuildState) => {
      queryClient.setQueryData(SITE_REBUILD_QUERY_KEY, state);
    },
    // 다시 시도 요청 자체가 실패했다 — 서버에 남은 상태를 다시 읽는다
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: SITE_REBUILD_QUERY_KEY });
    },
  });

  return {
    isFailed: query.data?.status === "failed",
    isRetrying: mutation.isPending,
    retry: () => {
      if (!mutation.isPending) mutation.mutate();
    },
    /** 발행 관련 저장 뒤 — 서버가 pending으로 바꿨으니 다시 읽어 폴링을 시작한다 */
    refresh: () => {
      void queryClient.invalidateQueries({ queryKey: SITE_REBUILD_QUERY_KEY });
    },
  };
}

export type SiteRebuild = ReturnType<typeof useSiteRebuild>;
