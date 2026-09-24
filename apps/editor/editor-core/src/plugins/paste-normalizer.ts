import { Fragment, Slice } from "@tiptap/pm/model";
import type { Attrs, Mark, Node } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import {
  fontOrNull,
  hrefOrNull,
  imagePathOrNull,
  languageOrNull,
  motionOrNull,
  naturalSizeOrNull,
  widthOrNull,
} from "../closed-values";

/**
 * 붙여넣은 조각을 넣을 자리에 맞게 저장 가능한 모양으로 만든다(spec: editor-paste, design.md 4).
 * 파싱 규칙이 값은 이미 걸렀지만 붙일 자리는 모른다 — 안쪽 노드에는 꾸밈 자리가 없다.
 * 에디터 안 복사처럼 규칙을 거치지 않는 경로도 있다고 보고 값 검증도 한 번 더 한다.
 * 근거: https://prosemirror.net/docs/ref/#view.EditorProps.transformPasted
 */

const DECORATION_VALUES = { font: fontOrNull, motion: motionOrNull, width: widthOrNull } as const;
const MEDIA_NODES = new Set(["image", "appScreenshot"]);
// 선택이 이 깊이 이하면 최상위 블록 안(또는 블록 사이)이다 — 붙인 조각의 최상위 노드가 최상위 블록이 된다
const TOP_LEVEL_DEPTH = 1;

function cleanAttrs(node: Node, keepDecoration: boolean): Attrs {
  const attrs: Record<string, unknown> = { ...node.attrs };
  if ("stickers" in attrs) attrs.stickers = null;
  for (const [key, valueOrNull] of Object.entries(DECORATION_VALUES)) {
    if (key in attrs) attrs[key] = keepDecoration ? valueOrNull(attrs[key]) : null;
  }
  if ("naturalWidth" in attrs) {
    const size = naturalSizeOrNull(attrs.naturalWidth, attrs.naturalHeight);
    attrs.naturalWidth = size?.naturalWidth ?? null;
    attrs.naturalHeight = size?.naturalHeight ?? null;
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
        normalizePastedSlice(slice, {
          intoTopLevel: view.state.selection.$from.depth <= TOP_LEVEL_DEPTH,
        }),
    },
  });
}
