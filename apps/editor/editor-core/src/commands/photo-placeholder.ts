/**
 * 사진 자리 · 사진 설명(adr-033). 설명은 사진 자리가 비워 둔 "이런 사진"이고, 채운 뒤에는 그림의 에디터 전용 칸으로 남아
 * 사진을 고를 때 참고가 된다. 근거 문서:
 * - Transaction.setNodeAttribute: https://prosemirror.net/docs/ref/#state.Transaction.setNodeAttribute
 * - Transform.replaceWith: https://prosemirror.net/docs/ref/#transform.Transform.replaceWith
 * - NodeSelection.create: https://prosemirror.net/docs/ref/#state.NodeSelection^create
 */
import { PHOTO_RATIOS } from "@blog-editor/content-schema";
import type { Command } from "@tiptap/pm/state";
import { NodeSelection } from "@tiptap/pm/state";
import { briefOrNull, naturalSizeFrom, promptOrNull } from "../closed-values";

const BRIEF_HOLDERS: ReadonlySet<string> = new Set(["image", "photoPlaceholder"]);

/**
 * pos의 그림 · 사진 자리의 설명을 바꾼다. 줄바꿈은 공백으로 모으고 앞뒤 공백을 뗀다. 그림은 빈 글이면 설명을 지우고,
 * 사진 자리는 설명이 전부라 빈 글이면 false다. 한도를 넘어도 false. 같은 값이면 dispatch 없이 true(#62 관례).
 */
export function setBrief(pos: number, brief: string): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    if (node === null || !BRIEF_HOLDERS.has(node.type.name)) return false;
    const next = briefOrNull(brief);
    const isCleared = brief.trim() === "";
    if (next === null && !(isCleared && node.type.name === "image")) return false;
    if (node.attrs.brief !== next) dispatch?.(state.tr.setNodeAttribute(pos, "brief", next));
    return true;
  };
}

/**
 * pos의 그림 · 사진 자리의 이미지 프롬프트(adr-043)를 바꾼다. 설명과 같은 규칙으로 모으고, 빈 글이면 지운다(프롬프트는
 * 둘 다에서 선택). 한도를 넘으면 false. 같은 값이면 dispatch 없이 true.
 */
export function setPrompt(pos: number, prompt: string): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    if (node === null || !BRIEF_HOLDERS.has(node.type.name)) return false;
    const next = promptOrNull(prompt);
    if (next === null && prompt.trim() !== "") return false;
    if (node.attrs.prompt !== next) dispatch?.(state.tr.setNodeAttribute(pos, "prompt", next));
    return true;
  };
}

/** 크기를 모르면 null */
function nearestRatio(width: unknown, height: unknown): (typeof PHOTO_RATIOS)[number] | null {
  const size = naturalSizeFrom(width, height);
  if (size === null) return null;
  const target = Math.log(size.width / size.height);
  const distance = (ratio: string) => {
    const [w, h] = ratio.split(":").map(Number);
    return Math.abs(Math.log((w ?? 1) / (h ?? 1)) - target);
  };
  return PHOTO_RATIOS.reduce((best, ratio) => (distance(ratio) < distance(best) ? ratio : best));
}

/**
 * 설명이 있는 그림을 그 설명(과 프롬프트)의 사진 자리로 되돌린다 — 사진을 바꾸고 싶을 때 설명을 잃지 않는 길이다.
 * 되돌린 사진 자리를 노드로 골라 바로 다시 채울 수 있게 한다. 설명이 없거나 그림이 아니면 false.
 */
export function imageToPlaceholder(pos: number): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    const placeholderType = state.schema.nodes.photoPlaceholder;
    if (node?.type.name !== "image" || placeholderType === undefined) return false;
    const brief = briefOrNull(node.attrs.brief);
    if (brief === null) return false;
    if (dispatch === undefined) return true;
    const placeholder = placeholderType.create({
      brief,
      ratio: nearestRatio(node.attrs.naturalWidth, node.attrs.naturalHeight),
      prompt: promptOrNull(node.attrs.prompt),
    });
    const tr = state.tr.replaceWith(pos, pos + node.nodeSize, placeholder);
    dispatch(tr.setSelection(NodeSelection.create(tr.doc, pos)));
    return true;
  };
}
