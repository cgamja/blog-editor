import type { Doc } from "@blog-editor/content-schema";

/** 지금 문서 — 닫힌 집합을 어기면 null이다(저장도 같은 이유로 실패하고 머리줄이 알린다) */
export function readDocOrNull(getDoc: () => Doc): Doc | null {
  try {
    return getDoc();
  } catch {
    return null;
  }
}
