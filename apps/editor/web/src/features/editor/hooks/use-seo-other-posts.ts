import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { seoOthersOf } from "@blog-editor/content-schema";
import { fetchPostSummaries } from "../api";
import { POST_SUMMARIES_QUERY_KEY } from "../constants";
import type { SeoOthers } from "../types";

/** 주소에는 줄바꿈이 없다(slugSchema) — 자기 글 주소 목록을 메모 키 하나로 */
const SLUG_SEPARATOR = "\n";

/**
 * 제목 · 설명 중복 점검에 쓰는 다른 글과 그 조회 상태 — `ownSlugs`(자기 글의 지금 · 옛 주소)는 뺀다.
 * 다른 글은 MCP와 같은 `seoOthersOf`로 만든다(adr-034). 캐시된 성공 데이터가 있으면 그것으로 점검한다(#166).
 * 목록 데이터와 자기 글 주소가 같으면 같은 객체를 돌려준다 — 머리줄 점검이 렌더마다 다시 매기지 않게.
 *
 * 데이터 없이 다시 읽기 시작하면 query-core가 `status`를 pending으로, `error`를 null로 되돌린다
 * (query-core `fetchState`) — `isError`만 보면 재시도 중에 loading으로 떨어져 점수가 보인다.
 * `errorUpdateCount`는 `error` 액션에서만 1씩 늘고 fetch로 되돌려지지 않으므로(query-core `query.ts` reducer)
 * "한 번이라도 실패로 끝났다"는 뜻이다.
 */
export function useSeoOtherPosts(ownSlugs: readonly (string | null)[]): SeoOthers {
  const { data, errorUpdateCount, refetch } = useQuery({
    queryKey: POST_SUMMARIES_QUERY_KEY,
    queryFn: fetchPostSummaries,
    select: seoOthersOf,
  });
  const ownKey = ownSlugs.join(SLUG_SEPARATOR);
  const hasFailed = errorUpdateCount > 0;
  return useMemo((): SeoOthers => {
    if (data !== undefined) {
      const own = ownKey.split(SLUG_SEPARATOR);
      return { kind: "ready", posts: data.filter(({ slug }) => !own.includes(slug)) };
    }
    // 읽는 중에 또 눌러도 데이터가 없으면 query-core가 진행 중인 요청을 이어 받는다(query.ts fetch)
    if (hasFailed) return { kind: "failed", retry: () => void refetch() };
    return { kind: "loading" };
  }, [data, ownKey, hasFailed, refetch]);
}
