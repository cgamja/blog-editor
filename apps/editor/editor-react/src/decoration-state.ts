import type { Node } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";
import {
  FONTS,
  MAX_STICKERS_PER_DOC,
  MOTIONS,
  STICKER_IDS,
  WIDTH_RANGE,
} from "@blog-editor/content-schema";
import {
  addSticker,
  selectedTopBlocks,
  setBlockFont,
  setBlockMotion,
  setBlockWidth,
} from "@blog-editor/editor-core";

/**
 * 꾸미기 패널이 보여 주는 값 — spec: decoration-panel, design.md 1 · 2.
 * EditorState에서만 파생한다(adr-006). 쓸 수 있는지는 커맨드를 dispatch 없이 불러 판정한다 —
 * #57이 can과 실행의 답이 같다고 고정했으므로 규칙을 여기서 다시 적지 않는다.
 */

export type Font = (typeof FONTS)[number];
export type Motion = (typeof MOTIONS)[number];
export type StickerId = (typeof STICKER_IDS)[number];

export type Availability = { enabled: true } | { enabled: false; reason: string };

export interface DecorationPanelState {
  /** 선택의 첫 최상위 블록 이름. 여러 블록이면 "블록 N개", 대상이 없으면 null */
  target: { label: string } | null;
  font: { value: Font | null; availability: Availability };
  motion: { value: Motion | null; availability: Availability };
  sticker: { count: number; availability: Availability };
  /** 그림 · 앱 스크린샷을 노드로 골랐을 때만 — 폭 도구줄의 대상 */
  width: { pos: number; value: number } | null;
}

export const FONT_OPTIONS: ReadonlyArray<{ value: Font; label: string }> = [
  { value: "pretendard", label: "Pretendard" },
  { value: "jua", label: "Jua" },
  { value: "gaegu", label: "Gaegu" },
];

/** 결정 2026-09-24: 스키마 5종 + 없음(디자인의 「살랑살랑 흔들리기」는 뺀다) */
export const MOTION_OPTIONS: ReadonlyArray<{ value: Motion | null; label: string }> = [
  { value: null, label: "없음" },
  { value: "pop", label: "톡 튀어나오기" },
  { value: "fade-in", label: "서서히 나타나기" },
  { value: "fade-up", label: "아래에서 올라오기" },
  { value: "slide-left", label: "왼쪽에서 들어오기" },
  { value: "slide-right", label: "오른쪽에서 들어오기" },
];

export const STICKER_OPTIONS: ReadonlyArray<{ id: StickerId; label: string }> = [
  { id: "star-coral", label: "코랄 별" },
  { id: "star-mint", label: "민트 별" },
  { id: "heart", label: "하트" },
  { id: "cloud", label: "구름" },
  { id: "bottle", label: "젖병" },
  { id: "rattle", label: "딸랑이" },
  { id: "pacifier", label: "쪽쪽이" },
  { id: "foot-coral", label: "코랄 발자국" },
  { id: "foot-mint", label: "민트 발자국" },
];

/** 결정 2026-09-24: 작게 50 · 보통 70 · 꽉 차게 100 */
export const WIDTH_PRESETS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 50, label: "작게" },
  { value: 70, label: "보통" },
  { value: 100, label: "꽉 차게" },
];

const BLOCK_LABELS: Record<string, string> = {
  paragraph: "문단",
  heading: "제목",
  bulletList: "목록",
  orderedList: "번호 목록",
  blockquote: "인용",
  codeBlock: "코드 블록",
  horizontalRule: "구분선",
  image: "사진",
  appScreenshot: "앱 스크린샷",
  callout: "콜아웃",
};

const NO_TARGET = "꾸밀 블록을 먼저 고르세요";
const STICKER_LIMIT = `스티커는 글 하나에 ${String(MAX_STICKERS_PER_DOC)}개까지예요`;
const ENABLED: Availability = { enabled: true };

const labelOf = (node: Node) => BLOCK_LABELS[node.type.name] ?? node.type.name;
const canHold = (node: Node, key: string) => Object.hasOwn(node.type.spec.attrs ?? {}, key);

/** 커맨드가 거절한 이유 — 대상이 없거나, 그 속성을 못 가지는 첫 블록 */
function blockedBy(blocks: readonly { node: Node }[], key: string, noun: string): Availability {
  const lacking = blocks.find(({ node }) => !canHold(node, key));
  return {
    enabled: false,
    reason: lacking === undefined ? NO_TARGET : `${labelOf(lacking.node)}에는 ${noun}`,
  };
}

function stickerCount(doc: Node): number {
  let count = 0;
  doc.forEach((block) => {
    count += Array.isArray(block.attrs.stickers) ? block.attrs.stickers.length : 0;
  });
  return count;
}

function stickerAvailability(state: EditorState, hasTarget: boolean, count: number): Availability {
  if (addSticker(STICKER_IDS[0])(state)) return ENABLED;
  if (!hasTarget) return { enabled: false, reason: NO_TARGET };
  return { enabled: false, reason: count >= MAX_STICKERS_PER_DOC ? STICKER_LIMIT : NO_TARGET };
}

/** 최상위 그림 · 스크린샷 노드 선택이면 폭 도구줄 대상. 폭이 없으면 렌더러 기본값(100)이다 */
export function widthTargetOf(state: EditorState): DecorationPanelState["width"] {
  const { selection } = state;
  if (!(selection instanceof NodeSelection) || selection.$from.depth !== 0) return null;
  if (!setBlockWidth(WIDTH_RANGE.max)(state)) return null;
  const width = selection.node.attrs.width as number | null;
  return { pos: selection.from, value: width ?? WIDTH_RANGE.max };
}

export function decorationPanelStateOf(state: EditorState): DecorationPanelState {
  const blocks = selectedTopBlocks(state);
  const first = blocks[0]?.node;
  const count = stickerCount(state.doc);
  const valueOf = <T>(key: string) =>
    first !== undefined && canHold(first, key) ? ((first.attrs[key] as T | null) ?? null) : null;

  return {
    target:
      first === undefined
        ? null
        : { label: blocks.length > 1 ? `블록 ${String(blocks.length)}개` : labelOf(first) },
    font: {
      value: valueOf<Font>("font"),
      availability: setBlockFont(FONTS[0])(state)
        ? ENABLED
        : blockedBy(blocks, "font", "글씨체를 줄 수 없어요"),
    },
    motion: {
      value: valueOf<Motion>("motion"),
      availability: setBlockMotion(MOTIONS[0])(state)
        ? ENABLED
        : blockedBy(blocks, "motion", "움직임을 줄 수 없어요"),
    },
    sticker: { count, availability: stickerAvailability(state, first !== undefined, count) },
    width: widthTargetOf(state),
  };
}
