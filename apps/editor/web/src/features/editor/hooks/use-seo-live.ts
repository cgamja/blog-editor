import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Doc, PostMeta } from "@blog-editor/content-schema";
import { isEditorComposing, useDocChange } from "@blog-editor/editor-react";
import type { BlockFlag, BlogEditorInstance } from "@blog-editor/editor-react";
import { SEO_LIVE_DELAY_MS } from "../constants";
import { readDocOrNull } from "../read-doc";
import { seoCheckOf, seoFlagsOf } from "../seo-check";
import type { SeoCheck, SeoOthers } from "../types";

export interface UseSeoLiveOptions {
  editor: BlogEditorInstance;
  getDoc: () => Doc;
  meta: PostMeta;
  slug: string;
  others: SeoOthers;
}

interface Snapshot {
  doc: Doc | null;
  meta: PostMeta;
  slug: string;
}

const NO_FLAGS: readonly BlockFlag[] = [];

/**
 * 머리줄 검색 노출 칩의 점검(#151) — 문서 · 제목 · 설명 · 핵심 검색어가 바뀌면 입력이 멈춘 뒤 다시 매긴다.
 * 한글 조합 중에는 문서를 읽지 않고 미룬다(use-autosave와 같은 `isEditorComposing`).
 * 매기는 함수는 발행 확인과 같은 `seoCheckOf`다.
 *
 * 문서가 바뀐 뒤 다시 매기기 전(`isStale`)에는 발견의 블록 번호가 지금 문서와 어긋날 수 있다 — 블록이 끼거나 빠지면
 * 옛 번호의 점이 엉뚱한 블록 옆에 선다. 그동안은 여백 점을 비운다(팝오버의 블록 항목도 같은 기준으로 막는다).
 */
export function useSeoLive({ editor, getDoc, meta, slug, others }: UseSeoLiveOptions) {
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({
    doc: readDocOrNull(getDoc),
    meta,
    slug,
  }));
  const [isStale, setIsStale] = useState(false);
  const latest = useRef({ getDoc, meta, slug });
  latest.current = { getDoc, meta, slug };
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    const run = () => {
      if (isEditorComposing(editor)) {
        timer.current = setTimeout(run, SEO_LIVE_DELAY_MS);
        return;
      }
      const current = latest.current;
      setSnapshot({ doc: readDocOrNull(current.getDoc), meta: current.meta, slug: current.slug });
      setIsStale(false);
    };
    timer.current = setTimeout(run, SEO_LIVE_DELAY_MS);
  }, [editor]);

  const onDocChange = useCallback(() => {
    setIsStale(true);
    schedule();
  }, [schedule]);
  useDocChange(editor, onDocChange);
  useEffect(() => {
    if (meta !== snapshot.meta || slug !== snapshot.slug) schedule();
  }, [meta, slug, snapshot, schedule]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const check: SeoCheck = useMemo(() => seoCheckOf({ ...snapshot, others }), [snapshot, others]);
  const flags = useMemo(
    () => (check.kind === "checked" ? seoFlagsOf(check.findings) : NO_FLAGS),
    [check],
  );
  return { check, flags: isStale ? NO_FLAGS : flags, isStale };
}
