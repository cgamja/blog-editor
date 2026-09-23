import type { Doc } from "./doc";

/**
 * 3.3에서 채운다: 마크 사전순 · 인접 텍스트 병합 · 빈 marks/attrs 키 제거 · 키 순서 고정 · 입력 불변.
 * 지금은 호출하면 던지는 자리표시자.
 */
export function normalize(doc: Doc): Doc {
  void doc;
  throw new Error("normalize: 기능 미구현");
}
