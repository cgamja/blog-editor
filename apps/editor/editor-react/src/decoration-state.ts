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
  canHoldDecoration,
  selectedTopBlocks,
  setBlockFont,
  setBlockMotion,
  setBlockWidth,
  stickerCount,
} from "@blog-editor/editor-core";
import type { TopBlock } from "@blog-editor/editor-core";
import { BLOCK_LABELS } from "./decoration-constants";
import { decorationMessages } from "./decoration-messages";
import type { Availability, DecorationPanelState, Font, Motion } from "./decoration-types";

/**
 * 꾸미기 패널이 보여 주는 값 — spec: decoration-panel, design.md 1 · 2.
 * EditorState에서만 파생한다(adr-006). 쓸 수 있는지는 커맨드를 dispatch 없이 불러 판정하고
 * (#57이 can과 실행의 답이 같다고 고정), 막힌 이유는 editor-core의 같은 판정(canHoldDecoration)으로 적는다.
 */

/** 막혔으면 이유 문장, 쓸 수 있으면 null — 컴포넌트가 disabled · aria-describedby에 쓴다 */
export const reasonOf = (availability: Availability): string | null =>
  availability.enabled ? null : availability.reason;

const ENABLED: Availability = { enabled: true };
const blocked = (reason: string): Availability => ({ enabled: false, reason });

const labelOf = (node: Node) => BLOCK_LABELS[node.type.name] ?? node.type.name;

function targetOf(blocks: readonly TopBlock[]): DecorationPanelState["target"] {
  const [first] = blocks;
  if (first === undefined) return null;
  if (blocks.length > 1) return { label: decorationMessages.multipleBlocks(blocks.length) };
  return { label: labelOf(first.node) };
}

/** 커맨드가 거절한 이유 — 그 속성을 못 가지는 첫 블록, 없으면 대상 없음 */
function blockedBy(
  blocks: readonly TopBlock[],
  key: string,
  message: (block: string) => string,
): Availability {
  const lacking = blocks.find(({ node }) => !canHoldDecoration(node, key));
  return blocked(
    lacking === undefined ? decorationMessages.noTarget : message(labelOf(lacking.node)),
  );
}

function stickerAvailability(state: EditorState, hasTarget: boolean, count: number): Availability {
  if (addSticker(STICKER_IDS[0])(state)) return ENABLED;
  if (hasTarget && count >= MAX_STICKERS_PER_DOC) return blocked(decorationMessages.stickerLimit);
  return blocked(decorationMessages.noTarget);
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
  const valueOf = <T>(key: string): T | null =>
    first !== undefined && canHoldDecoration(first, key)
      ? ((first.attrs[key] as T | null) ?? null)
      : null;

  return {
    target: targetOf(blocks),
    font: {
      value: valueOf<Font>("font"),
      availability: setBlockFont(FONTS[0])(state)
        ? ENABLED
        : blockedBy(blocks, "font", decorationMessages.cannotHoldFont),
    },
    motion: {
      value: valueOf<Motion>("motion"),
      availability: setBlockMotion(MOTIONS[0])(state)
        ? ENABLED
        : blockedBy(blocks, "motion", decorationMessages.cannotHoldMotion),
    },
    // 스텁 — 구현은 다음 커밋
    align: { value: null, availability: blocked("미구현") },
    sticker: { count, availability: stickerAvailability(state, first !== undefined, count) },
    width: widthTargetOf(state),
  };
}
