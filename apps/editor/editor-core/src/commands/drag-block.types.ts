/** 블록 손잡이 커맨드의 공개 타입 — spec: editor-block-drag. 커맨드는 drag-block.ts */

/** 최상위 블록 하나의 화면 세로 범위(getBoundingClientRect의 top · bottom) — 측정은 UI가 하고 여기는 숫자만 본다 */
export interface BlockBand {
  top: number;
  bottom: number;
}

export interface InsertableBlock {
  /** 스키마 노드 이름 */
  type: string;
  attrs?: Readonly<Record<string, unknown>>;
  /** 목록이면 첫 항목의 attrs — 할 일 목록은 체크하지 않은 할 일 항목 하나로 시작한다(adr-036) */
  itemAttrs?: Readonly<Record<string, unknown>>;
}
