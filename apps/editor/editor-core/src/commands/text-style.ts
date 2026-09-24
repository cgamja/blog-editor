import { textStyleAttrsSchema, weightFitsFont } from "@blog-editor/content-schema";
import { toggleMark } from "@tiptap/pm/commands";
import type { MarkType, Node } from "@tiptap/pm/model";
import type { Command, EditorState } from "@tiptap/pm/state";
import { lastColorKey } from "./text-style.constants";
import { MIXED, TOOLBAR_MARKS } from "./text-style.types";
import type {
  LastColor,
  SummaryValue,
  TextStylePatch,
  TextStyleSummary,
  ToolbarMark,
} from "./text-style.types";

/**
 * 글자 스타일(ADR-020 textStyle) 커맨드 — spec: editor-text-style, text-toolbar design.md 1~5.
 * 값 검증은 content-schema textStyleAttrsSchema 하나다 — 여기서 규칙을 다시 적지 않는다.
 */

type Attrs = Record<string, string>;

const STYLE_KEYS = ["font", "weight", "size", "color", "highlight"] as const;

interface Segment {
  from: number;
  to: number;
  node: Node;
}

/** 고른 범위에서 textStyle을 받을 수 있는 글자 조각들 — 코드 블록처럼 마크를 받지 않는 곳은 뺀다 */
function styleableSegments(state: EditorState, type: MarkType): Segment[] {
  const { from, to, empty } = state.selection;
  if (empty) return [];
  const segments: Segment[] = [];
  // https://prosemirror.net/docs/ref/#model.Node.nodesBetween · https://prosemirror.net/docs/ref/#model.NodeType.allowsMarkType
  state.doc.nodesBetween(from, to, (node, pos, parent) => {
    if (!node.isText || parent === null || !parent.type.allowsMarkType(type)) return true;
    segments.push({ from: Math.max(pos, from), to: Math.min(pos + node.nodeSize, to), node });
    return false;
  });
  return segments;
}

function styleOf(node: Node, type: MarkType): Attrs {
  const mark = type.isInSet(node.marks);
  if (mark === undefined) return {};
  return Object.fromEntries(
    Object.entries(mark.attrs).filter((entry): entry is [string, string] => entry[1] != null),
  );
}

function patched(current: Attrs, patch: TextStylePatch): Attrs {
  const next: Attrs = { ...current };
  for (const key of STYLE_KEYS) {
    const value = patch[key];
    if (value === null) delete next[key];
    else if (value !== undefined) next[key] = value;
  }
  // 글꼴을 바꿔 두께가 그 글꼴에 없게 되면 두께를 뗀다(design.md 2) — 두께를 직접 고른 patch는 검증이 거절한다
  if (patch.weight === undefined && !weightFitsFont(next)) delete next.weight;
  return next;
}

const isEmpty = (attrs: Attrs) => Object.keys(attrs).length === 0;

const sameAttrs = (left: Attrs, right: Attrs) =>
  STYLE_KEYS.every((key) => left[key] === right[key]);

/** 이번 patch가 거는 색 — ⌘⇧H가 다시 건다(design.md 4). 둘 다 걸면 글자색 */
function colorOfPatch(patch: TextStylePatch) {
  if (typeof patch.color === "string") return { key: "color" as const, value: patch.color };
  if (typeof patch.highlight === "string")
    return { key: "highlight" as const, value: patch.highlight };
  return null;
}

/**
 * 고른 글자 조각마다 textStyle 속성에 patch를 덮어쓴다. null은 그 속성을 지우고, 모두 비면 마크를 뗀다.
 * 결과가 정의 밖이거나 대상이 없으면 false, 바뀔 것이 없으면 dispatch 없이 true.
 * https://prosemirror.net/docs/ref/#transform.Transform.addMark
 */
export function setTextStyle(patch: TextStylePatch): Command {
  return (state, dispatch) => {
    const type = state.schema.marks.textStyle;
    if (type === undefined) return false;
    const segments = styleableSegments(state, type);
    if (segments.length === 0) return false;

    const tr = state.tr;
    for (const { from, to, node } of segments) {
      const current = styleOf(node, type);
      const next = patched(current, patch);
      if (!isEmpty(next) && !textStyleAttrsSchema.safeParse(next).success) return false;
      if (sameAttrs(current, next)) continue;
      tr.removeMark(from, to, type);
      if (!isEmpty(next)) tr.addMark(from, to, type.create(next));
    }
    if (!tr.docChanged) return true;
    if (dispatch) {
      const color = colorOfPatch(patch);
      dispatch(color === null ? tr : tr.setMeta(lastColorKey, color));
    }
    return true;
  };
}

function summarize<T>(values: T[]): SummaryValue<T> {
  const [first] = values;
  if (first === undefined) return null;
  return values.every((value) => value === first) ? first : MIXED;
}

/** 도구줄이 보일 값 — 속성마다 값 · 없음(null) · 여러 값(MIXED), 마크마다 모든 글자에 걸렸는가 */
export function textStyleSummary(state: EditorState): TextStyleSummary {
  const type = state.schema.marks.textStyle;
  const segments = type === undefined ? [] : styleableSegments(state, type);
  const styles = type === undefined ? [] : segments.map(({ node }) => styleOf(node, type));
  const valuesOf = (key: (typeof STYLE_KEYS)[number]) => styles.map((style) => style[key] ?? null);
  const hasMark = (name: ToolbarMark) => {
    const markType = state.schema.marks[name];
    return (
      markType !== undefined &&
      segments.length > 0 &&
      segments.every(({ node }) => markType.isInSet(node.marks) !== undefined)
    );
  };

  return {
    canStyle: segments.length > 0,
    font: summarize(valuesOf("font")) as TextStyleSummary["font"],
    weight: summarize(valuesOf("weight")) as TextStyleSummary["weight"],
    size: summarize(valuesOf("size")) as TextStyleSummary["size"],
    color: summarize(valuesOf("color")),
    highlight: summarize(valuesOf("highlight")),
    marks: Object.fromEntries(TOOLBAR_MARKS.map((name) => [name, hasMark(name)])) as Record<
      ToolbarMark,
      boolean
    >,
  };
}

/**
 * 도구줄 · 단축키의 마크 켜고 끄기(굵게 · 기울임 · 밑줄 · 취소선 · 코드).
 * https://prosemirror.net/docs/ref/#commands.toggleMark
 */
export function toggleToolbarMark(name: ToolbarMark): Command {
  return (state, dispatch) => {
    const type = state.schema.marks[name];
    return type === undefined ? false : toggleMark(type)(state, dispatch);
  };
}

export const rememberColor: (color: LastColor) => Command = () => {
  throw new Error("미구현");
};

/** 마지막에 건 글자색 · 배경색을 고른 글자에 다시 건다. 기억이 없으면 false */
export const applyLastColor: Command = (state, dispatch) => {
  const last = lastColorKey.getState(state);
  if (last == null) return false;
  return setTextStyle({ [last.key]: last.value })(state, dispatch);
};
