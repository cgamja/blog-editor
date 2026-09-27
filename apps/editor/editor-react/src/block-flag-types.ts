/** 여백 점의 세기 — 부르는 쪽(web)이 뜻(검색 노출 등급 등)을 이 셋에 맞춘다. editor-react는 그 뜻을 모른다 */
export type BlockFlagTone = "strong" | "medium" | "weak";

/**
 * 본문 최상위 블록 옆 오른쪽 여백에 띄우는 점 하나 — 인라인 마크(ProseMirror mark)와 다른 것이라 flag라 부른다
 */
export interface BlockFlag {
  /** 목록 안에서 겹치지 않는 키 */
  id: string;
  /** 최상위 블록 번호(0부터) */
  index: number;
  /** 점 버튼의 접근성 이름 — 점은 글자가 없어 이름이 곧 내용이다 */
  label: string;
  tone: BlockFlagTone;
}

/** 본문 여백 점과 누를 때 할 일 — 화면(EditorScreen)은 쓰지 않고 본문(BlogEditor)에 그대로 넘긴다 */
export interface BlockFlagSet {
  items: readonly BlockFlag[];
  onPress: (flag: BlockFlag) => void;
}

/** 한 블록 옆 점 줄의 틀(frame) 기준 자리 */
export interface BlockFlagRow {
  index: number;
  /** 줄 위 끝의 기준 — 블록 첫 줄의 세로 가운데(점은 CSS로 제 높이 절반만큼 올린다) */
  top: number;
  /** 줄 왼쪽 끝 — 블록 오른쪽 가장자리 */
  left: number;
  /** 줄이 쓸 수 있는 가로 폭(종이 오른쪽 끝까지) — 넘치면 점이 다음 줄로 내려간다 */
  maxWidth: number;
  /** 점에 올리거나 포커스하면 옅게 칠할 블록 사각형(틀 기준) */
  block: { top: number; left: number; width: number; height: number };
  flags: readonly BlockFlag[];
}
