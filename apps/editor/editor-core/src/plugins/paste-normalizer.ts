import { Fragment, Slice } from "@tiptap/pm/model";
import type { Attrs, Mark, Node } from "@tiptap/pm/model";
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";
import type { Selection } from "@tiptap/pm/state";
import {
  fontOrNull,
  hrefOrNull,
  imagePathOrNull,
  languageOrNull,
  motionOrNull,
  naturalSizeFrom,
  widthOrNull,
} from "../closed-values";

/**
 * 붙여넣은 조각을 넣을 자리에 맞게 저장 가능한 모양으로 만든다(spec: editor-paste, design.md 4).
 * 파싱 규칙이 값은 이미 걸렀지만 붙일 자리는 모른다 — 안쪽 노드에는 꾸밈 자리가 없다.
 * 복사 · 붙여넣기(에디터 안 포함)는 클립보드 HTML을 파싱 규칙으로 읽고, 규칙을 거치지 않는 경로는
 * 에디터 안 드래그다. 이 함수는 어느 경로인지 모르므로 값 검증도 한 번 더 한다.
 * 근거: https://prosemirror.net/docs/ref/#view.EditorProps.transformPasted
 */

const DECORATION_VALUES = { font: fontOrNull, motion: motionOrNull, width: widthOrNull } as const;
const MEDIA_NODES = new Set(["image", "appScreenshot"]);
// 텍스트 선택이 이 깊이 이하면 최상위 블록 안이다 — 붙인 조각의 최상위 노드가 최상위 블록이 된다
const TOP_LEVEL_DEPTH = 1;

/** 노드 선택이면 $from이 선택된 노드의 부모 안이다 — 그 노드가 최상위일 때(깊이 0)만 최상위 자리다. */
export function isTopLevelTarget(selection: Selection): boolean {
  return selection instanceof NodeSelection
    ? selection.$from.depth === 0
    : selection.$from.depth <= TOP_LEVEL_DEPTH;
}

function cleanAttrs(node: Node, keepDecoration: boolean): Attrs {
  const attrs: Record<string, unknown> = { ...node.attrs };
  if ("stickers" in attrs) attrs.stickers = null;
  for (const [key, valueOrNull] of Object.entries(DECORATION_VALUES)) {
    if (key in attrs) attrs[key] = keepDecoration ? valueOrNull(attrs[key]) : null;
  }
  if ("naturalWidth" in attrs) {
    const size = naturalSizeFrom(attrs.naturalWidth, attrs.naturalHeight);
    attrs.naturalWidth = size?.width ?? null;
    attrs.naturalHeight = size?.height ?? null;
  }
  if ("language" in attrs) attrs.language = languageOrNull(attrs.language);
  return attrs;
}

const allowedMarks = (marks: readonly Mark[]) =>
  marks.filter((mark) => mark.type.name !== "link" || hrefOrNull(mark.attrs.href) !== null);

function cleanNode(node: Node, isSliceTop: boolean, intoTopLevel: boolean): Node | null {
  if (node.isText) return node.mark(allowedMarks(node.marks));
  if (MEDIA_NODES.has(node.type.name) && imagePathOrNull(node.attrs.src) === null) return null;
  const children: Node[] = [];
  node.forEach((child) => {
    const cleaned = cleanNode(child, false, intoTopLevel);
    if (cleaned !== null) children.push(cleaned);
  });
  return node.type.create(
    cleanAttrs(node, intoTopLevel && isSliceTop),
    Fragment.fromArray(children),
    allowedMarks(node.marks),
  );
}

export function normalizePastedSlice(slice: Slice, options: { intoTopLevel: boolean }): Slice {
  const nodes: Node[] = [];
  slice.content.forEach((node) => {
    const cleaned = cleanNode(node, true, options.intoTopLevel);
    if (cleaned !== null) nodes.push(cleaned);
  });
  // 지우는 것은 원자 노드뿐이라 열린 끝(openStart · openEnd)은 그대로 둔다(design.md 4)
  return nodes.length === 0
    ? Slice.empty
    : new Slice(Fragment.fromArray(nodes), slice.openStart, slice.openEnd);
}

export const pasteNormalizerKey = new PluginKey("pasteNormalizer");

export function pasteNormalizer(): Plugin {
  return new Plugin({
    key: pasteNormalizerKey,
    props: {
      transformPasted: (slice, view) =>
        // 에디터 안 끌어 옮기기는 파싱 없이 내부 조각이 그대로 온다(prosemirror-view 1.42.5 handleDrop).
        // 이미 저장 가능한 모양이고 스티커를 지우면 옮기다 잃는다 — 안쪽에 떨어져 무효가 되면 blockGuard가 막는다
        view.dragging?.move
          ? slice
          : normalizePastedSlice(slice, { intoTopLevel: isTopLevelTarget(view.state.selection) }),
    },
  });
}
