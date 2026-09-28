import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { SESSION_EXPIRY_META } from "../../../shared/api/constants";
import { fetchPost } from "../api";
import { LIVE_REFLECT_INTERVAL_MS, NEW_POST_KEY, liveRevisionQueryKey } from "../constants";
import type { LoadedPost } from "../types";

/** 서버 판과 그 판을 읽기 시작할 때의 저장 표식(`PostSaver.syncMark`) */
export interface LiveRevision {
  post: LoadedPost;
  mark: number;
}

// 확인이 401이면 저장처럼 띠로 알린다 — 전역 처리가 로그인 화면으로 곧장 보내면 쓰던 글을 두고 떠난다
const KEEP_SESSION = { [SESSION_EXPIRY_META]: false };

/**
 * 열린 편집 화면이 서버 판을 읽는다(openspec editor-live-reflect) — 탭이 보이는 동안 주기로(TanStack Query
 * `refetchInterval`, 숨은 탭은 쉰다), 그리고 창에 돌아올 때. 읽기 시작할 때의 저장 표식을 함께 돌려준다 —
 * 읽는 사이 내 저장이 오갔는지 판단하는 쪽이 비교한다. `slug`가 null이면(아직 서버에 없는 글) 읽지 않는다.
 */
export function useLiveRevisionQuery(slug: string | null, syncMark: () => number) {
  const query = useQuery({
    queryKey: liveRevisionQueryKey(slug ?? NEW_POST_KEY),
    queryFn: async (): Promise<LiveRevision> => {
      const mark = syncMark();
      return { post: await fetchPost(slug ?? NEW_POST_KEY), mark };
    },
    enabled: slug !== null,
    refetchInterval: LIVE_REFLECT_INTERVAL_MS,
    // 창에 돌아올 때는 아래 이벤트로 직접 다시 읽는다 — TanStack v5는 window의 visibilitychange만 듣는다
    refetchOnWindowFocus: false,
    gcTime: 0,
    retry: false,
    meta: KEEP_SESSION,
  });
  const { refetch } = query;

  useEffect(() => {
    if (slug === null) return;
    const handleReturn = () => {
      if (document.visibilityState !== "hidden") void refetch();
    };
    window.addEventListener("focus", handleReturn);
    document.addEventListener("visibilitychange", handleReturn);
    return () => {
      window.removeEventListener("focus", handleReturn);
      document.removeEventListener("visibilitychange", handleReturn);
    };
  }, [slug, refetch]);

  return { data: query.data, dataUpdatedAt: query.dataUpdatedAt };
}
