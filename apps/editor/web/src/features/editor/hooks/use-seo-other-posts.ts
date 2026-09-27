import { useQuery } from "@tanstack/react-query";
import type { SeoOtherPost } from "@blog-editor/content-schema";
import { fetchSeoOtherPosts } from "../api";
import { SEO_OTHER_POSTS_QUERY_KEY } from "../constants";

/** 제목 · 설명 중복 점검에 쓰는 다른 글 — `ownSlugs`(자기 글의 지금 · 옛 주소)는 뺀다 */
export function useSeoOtherPosts(ownSlugs: readonly (string | null)[]): SeoOtherPost[] {
  const others = useQuery({ queryKey: SEO_OTHER_POSTS_QUERY_KEY, queryFn: fetchSeoOtherPosts });
  return (others.data ?? []).filter(({ slug }) => !ownSlugs.includes(slug));
}
