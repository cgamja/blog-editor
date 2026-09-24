import type { ALIGNS } from "@blog-editor/content-schema";

/** 블록 조절의 공개 타입 — spec: editor-block-drag · editor-block-resize. 커맨드는 block-controls.ts */

/** 그림 · 앱 스크린샷 폭 손잡이 끌기 한 번의 입력 */
export interface WidthDrag {
  /** 끌기를 시작할 때의 폭(%) */
  startPercent: number;
  /** 끌기를 시작한 포인터 x · 지금 x(화면 px) */
  startX: number;
  x: number;
  /** 잡은 손잡이 */
  side: "left" | "right";
  /** 폭 100%가 되는 본문 폭(px) */
  containerWidth: number;
  /** 블록 정렬(adr-020) — 없으면 가운데. 한쪽 정렬이면 반대쪽이 고정이라 끈 만큼만 바뀐다 */
  align?: (typeof ALIGNS)[number];
}

/** 블록 메뉴 「바꾸기」 한 항목 — 글자 블록으로 바꾸거나(textblock) 감싼다(wrap) */
export type TurnIntoTarget =
  | { via: "textblock"; type: string; attrs?: Readonly<Record<string, unknown>> }
  | { via: "wrap"; wrapper: "bulletList" | "orderedList" | "blockquote" };

/** 폭 미리보기 — 끄는 동안 그 블록에 보일 폭(%). 문서 값이 아니다(widthPreview 플러그인 상태) */
export interface WidthPreviewState {
  pos: number;
  width: number;
}
