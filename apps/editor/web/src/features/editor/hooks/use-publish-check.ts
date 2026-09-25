import { useState } from "react";
import type { Doc } from "@blog-editor/content-schema";
import { readDocOrNull } from "../read-doc";
import { useOtherPostTitles } from "./use-other-post-titles";

/**
 * 발행 확인의 검색 노출 점검 재료(adr-030) — 확인을 연 순간의 문서와 제목 중복을 볼 다른 글.
 * 점검 자체(`checkSeo`)는 대화상자가 그릴 때 한다.
 */
export function usePublishCheck(getDoc: () => Doc, ownSlugs: readonly (string | null)[]) {
  const [publishDoc, setPublishDoc] = useState<Doc | null>(null);
  const otherPosts = useOtherPostTitles(ownSlugs);
  return {
    publishDoc,
    otherPosts,
    captureDoc: () => setPublishDoc(readDocOrNull(getDoc)),
  };
}
