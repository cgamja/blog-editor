import { useMemo } from "react";
import type { Doc, PostMeta } from "@blog-editor/content-schema";
import type { BlockFlagSet, BlogEditorInstance, SideTab } from "@blog-editor/editor-react";
import type { SeoOthers } from "../types";
import { useSeoJump } from "./use-seo-jump";
import { useSeoLive } from "./use-seo-live";

export interface UseEditorSeoOptions {
  editor: BlogEditorInstance;
  getDoc: () => Doc;
  /** 점검할 글 정보 — 「글 정보」 입력 상태(usePostForm)를 그대로 넘긴다 */
  post: { meta: PostMeta; slug: string };
  others: SeoOthers;
  openTab: (tab: SideTab) => void;
}

/**
 * 편집 화면의 검색 노출(#151 디자인 C) 한 묶음 — 입력마다 다시 매긴 점검(`useSeoLive`), 발견 자리로 가기(`useSeoJump`),
 * 본문 여백 점. 화면은 칩 · 점 · 메타 칸 ref만 받아 그린다.
 */
export function useEditorSeo({ editor, getDoc, post, others, openTab }: UseEditorSeoOptions) {
  const live = useSeoLive({ editor, getDoc, meta: post.meta, slug: post.slug, others });
  const jump = useSeoJump(editor, openTab);
  const { jumpTo } = jump;
  const blockFlags = useMemo(
    (): BlockFlagSet => ({
      items: live.flags,
      // 점의 블록 번호는 0부터, 발견의 블록 번호는 1부터(변환 메시지의 "블록 N")
      onPress: (flag) => jumpTo({ kind: "block", block: flag.index + 1 }),
    }),
    [live.flags, jumpTo],
  );
  return {
    check: live.check,
    isStale: live.isStale,
    blockFlags,
    jumpTo,
    fieldRefs: jump.fieldRefs,
  };
}
