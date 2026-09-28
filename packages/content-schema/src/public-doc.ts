import type { Block, Doc } from "./doc";

/**
 * 공개용 문서(adr-033 · adr-043) — 에디터 전용인 사진 자리와 그림 설명(`brief`) · 이미지 프롬프트(`prompt`)를 뺀다.
 * 렌더러도 셋을 그리지 않지만(첫 번째 방어) 공개 조회는 렌더 전에 이것을 거친다(두 번째 방어). 입력은 바꾸지 않는다.
 * 사진 자리만 있던 글이면 content가 빌 수 있다 — 저장 형식이 아니라 렌더 입력이라 그대로 둔다.
 */
export function publicDocOf(doc: Doc): Doc {
  const content = doc.content.flatMap((block): Block[] => {
    if (block.type === "photoPlaceholder") return [];
    if (
      block.type === "image" &&
      (block.attrs.brief !== undefined || block.attrs.prompt !== undefined)
    ) {
      const attrs = { ...block.attrs };
      delete attrs.brief;
      delete attrs.prompt;
      return [{ ...block, attrs }];
    }
    return [block];
  });
  return { ...doc, content };
}
