/**
 * 이미지를 올리는 동안의 자리 — spec: editor-image-insert, image-insert design.md 1.
 * 자리를 문서 노드로 넣으면 저장 · 되돌리기 기록에 임시 노드가 샌다(닫힌 집합 밖). 그래서 플러그인 상태에만
 * 두고 widget 장식으로 그린다. 근거 문서:
 * - Decoration.widget: https://prosemirror.net/docs/ref/#view.Decoration^widget
 * - StateField.apply · Mapping.mapResult · MapResult.deletedAcross:
 *   https://prosemirror.net/docs/ref/#state.StateField.apply · https://prosemirror.net/docs/ref/#transform.MapResult
 * - NodeSelection.create: https://prosemirror.net/docs/ref/#state.NodeSelection^create
 * - ReplaceStep(from · to · slice) · Transform.docs: https://prosemirror.net/docs/ref/#transform.ReplaceStep ·
 *   https://prosemirror.net/docs/ref/#transform.Transform.docs
 */
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";
import type { Command, EditorState, Transaction } from "@tiptap/pm/state";
import type { Node as PmNode, Slice } from "@tiptap/pm/model";
import { ReplaceStep } from "@tiptap/pm/transform";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { ALT_MAX_LENGTH } from "@blog-editor/content-schema";
import { imagePathOrNull, naturalSizeFrom } from "../closed-values";
import type {
  ImageUploadEntry,
  ImageUploadPlacement,
  ImageUploadRender,
  UploadedImageAttrs,
} from "./image-upload.types";

/**
 * 플러그인 상태의 자리 — 밖에 보이는 ImageUploadEntry에 더해, 자리를 둔 뒤 사용자가 손을 댔는지(글 · 선택이
 * 바뀌었는지)를 들고 있다. 좌표 비교는 같은 자리에서 이어 쓰면 매핑된 선택과 지금 선택이 같아져 틀린다.
 * 손대지 않았으면 끝날 때 넣은 그림을 고르고, 손댔으면 커서를 뺏지 않는다.
 */
interface TrackedUpload extends ImageUploadEntry {
  isTouched: boolean;
  /**
   * 채울 사진 자리의 설명 — 자리 바로 뒤 사진 자리를 채우는 올리기(adr-033)면 올리기를 시작할 때 그 사진 자리의 brief,
   * 아니면 null. 끝날 때 자리 바로 뒤 사진 자리의 설명이 이것과 같을 때만 채운다 — 그새 그 사진 자리가 지워져 다른
   * 사진 자리가 붙었으면 그것을 채우지 않고 그냥 넣는다(adr-039).
   */
  fillBrief: string | null;
}

export const imageUploadKey = new PluginKey<readonly TrackedUpload[]>("imageUpload");

type UploadMeta =
  | { type: "start"; id: string; pos: number; fillBrief: string | null }
  | { type: "fail"; id: string; message: string }
  /** 실패한 자리를 같은 자리 · 같은 채우기로 다시 올린다 */
  | { type: "retry"; id: string }
  | { type: "remove"; id: string }
  /** 끝난 올리기 — 그 자리(`pos`, 이 트랜잭션 전 좌표)에서 기다리던 다른 자리는 넣은 그림 뒤(`after`)로 간다 */
  | { type: "finish"; id: string; pos: number; after: number };

/** 자리는 뒤 블록 쪽에 붙는다 — 같은 자리에 앞 그림이 들어가면 뒤 자리는 그 뒤로 밀린다(파일 순서 유지) */
const STICK_TO_NEXT = 1;

/** 문서가 잎 블록(그림 · 사진 자리) 하나뿐이고 그것을 잎 블록 하나로 바꾸는가 — 사진 자리 채우기와 그 되돌리기 */
function isLeafSwap(before: PmNode, slice: Slice): boolean {
  const old = before.childCount === 1 ? before.firstChild : null;
  const fresh = slice.content.childCount === 1 ? slice.content.firstChild : null;
  return old !== null && fresh !== null && old.isLeaf && fresh.isLeaf;
}

/**
 * 트랜잭션이 문서를 통째로 바꿨는가 — 0부터 그 단계 전 문서 끝까지를 덮는 ReplaceStep이 있으면 그렇다.
 * ReplaceAroundStep(setNodeMarkup으로 글꼴 등 블록 꾸밈 바꾸기)은 내용을 남기므로 아니다. 잎 블록 하나뿐인 문서에서 그
 * 블록을 바꾸는 것도 블록 하나를 바꾼 것이지 새로 쓴 것이 아니다 — 잎 노드의 setNodeMarkup도 replaceWith가 된다.
 */
function replacesWholeDoc(tr: Transaction): boolean {
  return tr.steps.some((step, index) => {
    const before = tr.docs[index];
    if (!(step instanceof ReplaceStep) || before === undefined) return false;
    return step.from === 0 && step.to === before.content.size && !isLeafSwap(before, step.slice);
  });
}

/**
 * 삭제가 자리를 가로지르면(되돌리기로 그 자리가 지워진 경우 포함) 자리는 사라진다 — 끝난 결과는 버린다.
 * 문서 맨 앞 · 맨 끝 자리는 한쪽이 문서 경계라 가로지름이 잡히지 않는다. 맨 앞 자리는 뒤쪽이 지워지면 버린다.
 * 맨 끝 자리는 문서를 통째로 바꾼 경우에만 버린다 — 전체를 지우고 새로 쓴 문서에 옛 그림이 끼어들지 않게. 바로 앞
 * 블록만 바뀐 것(사진 자리 채우기 · 되돌리기 · 꾸밈 바꾸기)이면 살아서 끝에 들어간다(adr-039).
 */
function survives(entry: TrackedUpload, tr: Transaction): { pos: number } | null {
  const result = tr.mapping.mapResult(entry.pos, STICK_TO_NEXT);
  const isAtStart = entry.pos === 0;
  const isAtEnd = entry.pos === tr.before.content.size;
  const isLost =
    result.deletedAcross || (isAtStart && result.deletedAfter) || (isAtEnd && replacesWholeDoc(tr));
  return isLost ? null : { pos: result.pos };
}

/**
 * 끝난 올리기와 같은 자리에서 기다리던 자리는 매핑하지 않고 넣은 그림 바로 뒤로 옮긴다 — 파일 순서를 지키고,
 * 채우기가 사진 자리를 지운 것을 그 자리의 삭제로 잘못 읽지 않으려고다. StepMap은 바뀐 범위의 시작(pos === start)을
 * 앞쪽으로 매핑하고(assoc와 무관하게 side -1) DEL_AFTER를 단다 — 끼워 넣기(oldSize 0)도 DEL_AFTER다. 그래서 매핑에
 * 맡기면 사진 자리를 바꾼 그림 앞에 남아 순서가 뒤집히고, 문서 맨 앞 자리는 지워진 자리로 버려진다.
 * 근거: https://prosemirror.net/docs/ref/#transform.StepMap · https://prosemirror.net/docs/ref/#transform.MapResult.deletedAfter
 */
function mapEntries(
  entries: readonly TrackedUpload[],
  tr: Transaction,
  meta: UploadMeta | undefined,
): TrackedUpload[] {
  return entries.flatMap((entry) => {
    const isBehindFinished =
      meta?.type === "finish" && entry.id !== meta.id && entry.pos === meta.pos;
    if (isBehindFinished) return [{ ...entry, pos: meta.after }];
    const mapped = survives(entry, tr);
    return mapped === null ? [] : [{ ...entry, pos: mapped.pos }];
  });
}

function applyMeta(entries: TrackedUpload[], meta: UploadMeta): TrackedUpload[] {
  if (meta.type === "start") {
    const { id, pos, fillBrief } = meta;
    return [...entries, { id, pos, status: "uploading", isTouched: false, fillBrief }];
  }
  if (meta.type === "retry") {
    // 처음 올리기처럼 손대지 않은 자리로 되돌린다 — 끝나면 넣은 그림을 고른다
    return entries.map((entry) =>
      entry.id === meta.id
        ? {
            id: entry.id,
            pos: entry.pos,
            status: "uploading",
            isTouched: false,
            fillBrief: entry.fillBrief,
          }
        : entry,
    );
  }
  if (meta.type === "fail") {
    return entries.map((entry) =>
      entry.id === meta.id ? { ...entry, status: "failed", message: meta.message } : entry,
    );
  }
  // remove · finish — 끝난 자리도 목록에서 빠진다
  return entries.filter((entry) => entry.id !== meta.id);
}

/** 자리 장식은 render가 있을 때만 그린다 — 상태 계산(테스트)은 DOM 없이 돈다 */
export function imageUpload(render?: ImageUploadRender): Plugin<readonly TrackedUpload[]> {
  return new Plugin<readonly TrackedUpload[]>({
    key: imageUploadKey,
    state: {
      init: () => [],
      apply(tr, previous) {
        const meta = tr.getMeta(imageUploadKey) as UploadMeta | undefined;
        const mapped = tr.docChanged ? mapEntries(previous, tr, meta) : [...previous];
        // 자리를 두는 트랜잭션 말고 글이나 선택이 바뀌면 그 전부터 있던 자리는 모두 "손댔다"
        const isEdited =
          meta?.type !== "start" && meta?.type !== "retry" && (tr.docChanged || tr.selectionSet);
        const marked = isEdited ? mapped.map((entry) => ({ ...entry, isTouched: true })) : mapped;
        return meta === undefined ? marked : applyMeta(marked, meta);
      },
    },
    props: {
      decorations(state) {
        const entries = imageUploadKey.getState(state) ?? [];
        if (render === undefined || entries.length === 0) return null;
        return DecorationSet.create(
          state.doc,
          entries.map((entry) =>
            Decoration.widget(entry.pos, render(publicEntry(entry)), {
              // 상태가 바뀌면 key가 달라져 DOM을 새로 그린다(실패 문장 · 버튼)
              key: `${entry.id}:${entry.status}:${entry.message ?? ""}`,
              side: STICK_TO_NEXT,
            }),
          ),
        );
      },
    },
  });
}

function publicEntry({ id, pos, status, message }: TrackedUpload): ImageUploadEntry {
  return message === undefined ? { id, pos, status } : { id, pos, status, message };
}

export function imageUploadsOf(state: EditorState): readonly ImageUploadEntry[] {
  return (imageUploadKey.getState(state) ?? []).map(publicEntry);
}

/**
 * pos에서 가장 가까운 최상위 블록 사이 자리. 이미 최상위 자리면 그대로, 블록 안이면 그 최상위 블록의
 * 앞(before) 또는 뒤.
 */
export function nearestTopGap(doc: PmNode, pos: number, before: boolean): number {
  const clamped = Math.min(Math.max(pos, 0), doc.content.size);
  const $pos = doc.resolve(clamped);
  if ($pos.depth === 0) return clamped;
  return before ? $pos.before(1) : $pos.after(1);
}

/** 선택이 든 최상위 블록 바로 뒤 자리 — 「+」 메뉴 · 붙여넣기가 그림을 넣는 곳 */
export function topGapAfterSelection(state: EditorState): number {
  const { selection, doc } = state;
  return nearestTopGap(doc, selection.to, false);
}

const isTopGap = (doc: PmNode, pos: number) =>
  Number.isInteger(pos) && pos >= 0 && pos <= doc.content.size && doc.resolve(pos).depth === 0;

const hasPlugin = (state: EditorState) => imageUploadKey.getState(state) !== undefined;

/**
 * 올린 사람이 대체 텍스트를 따로 쓰지 않았으면 사진 자리 설명을 alt 기본값으로 쓴다(adr-033). 설명이 alt보다 길면
 * 코드포인트 단위로 자른다 — UTF-16 단위로 자르면 이모지 한가운데서 끊겨 외톨이 서러게이트가 남는다.
 */
function altFromBrief(alt: string, brief: string | null): string {
  if (alt !== "" || brief === null) return alt;
  return Array.from(brief).slice(0, ALT_MAX_LENGTH).join("");
}

const findEntry = (state: EditorState, id: string) =>
  (imageUploadKey.getState(state) ?? []).find((entry) => entry.id === id);

/** 최상위 자리 pos에 올리는 중 자리를 더한다 — 문서는 그대로다(메타만) */
export function startImageUpload(
  id: string,
  pos: number,
  placement: ImageUploadPlacement = {},
): Command {
  return (state, dispatch) => {
    if (!hasPlugin(state) || !isTopGap(state.doc, pos) || findEntry(state, id) !== undefined) {
      return false;
    }
    const target = placement.fill === true ? photoPlaceholderAt(state.doc, pos) : null;
    const fillBrief = (target?.attrs.brief as string | undefined) ?? null;
    dispatch?.(
      state.tr.setMeta(imageUploadKey, { type: "start", id, pos, fillBrief } satisfies UploadMeta),
    );
    return true;
  };
}

/** 자리 바로 뒤가 사진 자리면 그 노드 — 채우기 올리기가 바꿀 대상이다 */
function photoPlaceholderAt(doc: PmNode, gap: number): PmNode | null {
  const next = doc.resolve(gap).nodeAfter;
  return next?.type.name === "photoPlaceholder" ? next : null;
}

/** 올리기가 실패하면 자리에 이유를 남긴다 — 다시 시도 · 지우기는 자리를 그린 쪽이 한다 */
export function failImageUpload(id: string, message: string): Command {
  return (state, dispatch) => {
    if (findEntry(state, id) === undefined) return false;
    dispatch?.(
      state.tr.setMeta(imageUploadKey, { type: "fail", id, message } satisfies UploadMeta),
    );
    return true;
  };
}

/**
 * 실패한 올리기를 같은 자리에서 다시 올리는 중으로 되돌린다 — 채우기였다면 처음 고른 사진 자리를 그대로 채운다(#172).
 * 실패한 자리가 아니면 false다. 파일을 다시 올리는 일은 자리를 그린 쪽(올리기 줄)이 한다.
 */
export function retryImageUpload(id: string): Command {
  return (state, dispatch) => {
    if (findEntry(state, id)?.status !== "failed") return false;
    dispatch?.(state.tr.setMeta(imageUploadKey, { type: "retry", id } satisfies UploadMeta));
    return true;
  };
}

export function cancelImageUpload(id: string): Command {
  return (state, dispatch) => {
    if (findEntry(state, id) === undefined) return false;
    dispatch?.(state.tr.setMeta(imageUploadKey, { type: "remove", id } satisfies UploadMeta));
    return true;
  };
}

/**
 * 올리기가 끝나면 자리에 image 노드를 넣고 자리를 지운다 — 한 트랜잭션이라 undo 한 번에 돌아간다.
 * 자리가 없으면(지워졌거나 취소) false — 끝난 결과는 버린다. 자리를 둔 뒤 손대지 않았으면 넣은 그림을 노드로 골라
 * 대체 텍스트 입력이 바로 뜨게 하고 그림으로 스크롤한다. 그사이 쓰거나 커서를 옮겼다면 커서를 뺏지 않는다
 * (선택은 삽입에 맞춰 매핑될 뿐이고 스크롤도 하지 않는다).
 */
export function finishImageUpload(id: string, attrs: UploadedImageAttrs): Command {
  return (state, dispatch) => {
    const entry = findEntry(state, id);
    const imageType = state.schema.nodes.image;
    const size = naturalSizeFrom(attrs.naturalWidth, attrs.naturalHeight);
    if (entry === undefined || imageType === undefined) return false;
    if (imagePathOrNull(attrs.src) === null || size === null) return false;
    if (dispatch === undefined) return true;

    const gap = nearestTopGap(state.doc, entry.pos, false);
    // 채우기면 사진 자리의 설명을 alt 기본값과 그림 설명으로 옮긴다(adr-033). 그새 그 사진 자리가 없어졌으면
    // (바로 뒤가 사진 자리가 아니거나 설명이 다른 사진 자리) 채우지 않고 그냥 넣는다(adr-039)
    const next = entry.fillBrief === null ? null : photoPlaceholderAt(state.doc, gap);
    const placeholder = next?.attrs.brief === entry.fillBrief ? next : null;
    const brief = (placeholder?.attrs.brief as string | undefined) ?? null;
    const image = imageType.create({
      src: attrs.src,
      alt: altFromBrief(attrs.alt, brief),
      brief,
      naturalWidth: size.width,
      naturalHeight: size.height,
    });
    const tr = (
      placeholder === null
        ? state.tr.insert(gap, image)
        : state.tr.replaceWith(gap, gap + placeholder.nodeSize, image)
    ).setMeta(imageUploadKey, {
      type: "finish",
      id,
      pos: entry.pos,
      after: gap + image.nodeSize,
    } satisfies UploadMeta);
    if (!entry.isTouched) {
      tr.setSelection(NodeSelection.create(tr.doc, gap)).scrollIntoView();
    }
    dispatch(tr);
    return true;
  };
}
