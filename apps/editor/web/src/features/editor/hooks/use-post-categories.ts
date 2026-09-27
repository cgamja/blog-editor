import { useQuery } from "@tanstack/react-query";
import { categoriesOf, fetchPostSummaries } from "../api";
import { POST_SUMMARIES_QUERY_KEY } from "../constants";

/** 「글 정보」 카테고리 제안 — 발행 확인의 중복 점검과 같은 글 목록 요약을 `select`로 나눠 쓴다. 읽기 전 · 실패면 빈 목록 */
export function usePostCategories(): readonly string[] {
  const categories = useQuery({
    queryKey: POST_SUMMARIES_QUERY_KEY,
    queryFn: fetchPostSummaries,
    select: categoriesOf,
  });
  return categories.data ?? NO_CATEGORIES;
}

const NO_CATEGORIES: readonly string[] = [];
