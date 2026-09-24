/** 글자 서식 도구줄의 타입 — spec: editor-text-style. */

/** 도구줄 안에서 펼치는 것들 — 한 번에 하나만 열린다 */
export type TextStyleMenu = "font" | "weight" | "size" | "color" | "highlight";

/** 글자색 · 배경색 */
export type ColorKind = "color" | "highlight";

/** 로빙 tabindex 한 칸(APG toolbar) — 도구줄이 순서와 포커스를 맡는다 */
export interface ToolbarItemProps {
  tabIndex: number;
  registerButton: (button: HTMLButtonElement | null) => void;
}

export interface ToolbarMenuOption {
  /** null은 "기본"(속성 지우기) */
  value: string | null;
  label: string;
  /** 항목을 그 글꼴로 보여 준다(text-toolbar.css) */
  previewFont?: string;
}

/** 도구줄을 띄울지 정하는 재료 — shouldShowToolbar */
export interface ToolbarVisibility {
  canStyle: boolean;
  selection: "text" | "all" | "node" | "other";
  composing: boolean;
  editable: boolean;
  /** 편집 영역이나 도구줄에 포커스가 있다 */
  focused: boolean;
  /** 마우스로 끌어 고르는 중이다 */
  pointerSelecting: boolean;
}
