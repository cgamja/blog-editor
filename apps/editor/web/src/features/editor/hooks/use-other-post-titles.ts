import { useQuery } from "@tanstack/react-query";
import type { SeoOtherPost } from "@blog-editor/content-schema";
import { fetchPostTitles } from "../api";
import { POST_TITLES_QUERY_KEY } from "../constants";

/** 제목 중복 점검에 쓰는 다른 글 — `ownSlugs`(자기 글의 지금 · 옛 주소)는 뺀다 */
export function useOtherPostTitles(ownSlugs: readonly (string | null)[]): SeoOtherPost[] {
  const titles = useQuery({ queryKey: POST_TITLES_QUERY_KEY, queryFn: fetchPostTitles });
  return (titles.data ?? []).filter(({ slug }) => !ownSlugs.includes(slug));
}
