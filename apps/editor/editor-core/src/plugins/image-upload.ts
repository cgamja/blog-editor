/**
 * 이미지를 올리는 동안의 자리 — spec: editor-image-insert, image-insert design.md 1.
 * 자리를 문서 노드로 넣으면 저장 · 되돌리기 기록에 임시 노드가 샌다(닫힌 집합 밖). 그래서 플러그인 상태에만
 * 두고 widget 장식으로 그린다. 근거 문서:
 * - Decoration.widget: https://prosemirror.net/docs/ref/#view.Decoration^widget
 * - StateField.apply · Mapping.mapResult · MapResult.deletedAcross:
 *   https://prosemirror.net/docs/ref/#state.StateField.apply · https://prosemirror.net/docs/ref/#transform.MapResult
 * - NodeSelection.create: https://prosemirror.net/docs/ref/#state.NodeSelection^create
 */
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";
import type { Command, EditorState, Transaction } from "@tiptap/pm/state";
import type { Node as PmNode } from "@tiptap/pm/model";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { imagePathOrNull, naturalSizeFrom } from "../closed-values";
import type { ImageUploadEntry, ImageUploadRender, UploadedImageAttrs } from "./image-upload.types";

/**
 * 플러그인 상태의 자리 — 밖에 보이는 ImageUploadEntry에 더해, 자리를 둔 뒤 사용자가 손을 댔는지(글 · 선택이
 * 바뀌었는지)를 들고 있다. 좌표 비교는 같은 자리에서 이어 쓰면 매핑된 선택과 지금 선택이 같아져 틀린다.
 * 손대지 않았으면 끝날 때 넣은 그림을 고르고, 손댔으면 커서를 뺏지 않는다.
 */
interface TrackedUpload extends ImageUploadEntry {
  isTouched: boolean;
}

export const imageUploadKey = new PluginKey<readonly TrackedUpload[]>("imageUpload");

type UploadMeta =
  | { type: "start"; id: string; pos: number }
  | { type: "fail"; id: string; message: string }
  | { type: "remove"; id: string };

/** 자리는 뒤 블록 쪽에 붙는다 — 같은 자리에 앞 그림이 들어가면 뒤 자리는 그 뒤로 밀린다(파일 순서 유지) */
const STICK_TO_NEXT = 1;

/**
 * 삭제가 자리를 가로지르면(되돌리기로 그 자리가 지워진 경우 포함) 자리는 사라진다 — 끝난 결과는 버린다.
 * 문서 맨 앞 · 맨 끝 자리는 한쪽이 문서 경계라 가로지름이 잡히지 않는다 — 경계 아닌 쪽이 지워지면 버린다
 * (전체를 지우고 새로 쓴 문서에 옛 그림이 끼어들지 않게).
 */
function survives(entry: TrackedUpload, tr: Transaction): { pos: number } | null {
  const result = tr.mapping.mapResult(entry.pos, STICK_TO_NEXT);
  const isAtStart = entry.pos === 0;
  const isAtEnd = entry.pos === tr.before.content.size;
  const isLost =
    result.deletedAcross || (isAtStart && result.deletedAfter) || (isAtEnd && result.deletedBefore);
  return isLost ? null : { pos: result.pos };
}

function mapEntries(entries: readonly TrackedUpload[], tr: Transaction): TrackedUpload[] {
  return entries.flatMap((entry) => {
    const mapped = survives(entry, tr);
    return mapped === null ? [] : [{ ...entry, pos: mapped.pos }];
  });
}

function applyMeta(entries: TrackedUpload[], meta: UploadMeta): TrackedUpload[] {
  if (meta.type === "start") {
    const { id, pos } = meta;
    return [...entries, { id, pos, status: "uploading", isTouched: false }];
  }
  if (meta.type === "fail") {
    return entries.map((entry) =>
      entry.id === meta.id ? { ...entry, status: "failed", message: meta.message } : entry,
    );
  }
  return entries.filter((entry) => entry.id !== meta.id);
}

/** 자리 장식은 render가 있을 때만 그린다 — 상태 계산(테스트)은 DOM 없이 돈다 */
export function imageUpload(render?: ImageUploadRender): Plugin<readonly TrackedUpload[]> {
  return new Plugin<readonly TrackedUpload[]>({
    key: imageUploadKey,
    state: {
      init: () => [],
      apply(tr, previous) {
        const mapped = tr.docChanged ? mapEntries(previous, tr) : [...previous];
        const meta = tr.getMeta(imageUploadKey) as UploadMeta | undefined;
        // 자리를 두는 트랜잭션 말고 글이나 선택이 바뀌면 그 전부터 있던 자리는 모두 "손댔다"
        const isEdited = meta?.type !== "start" && (tr.docChanged || tr.selectionSet);
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

const findEntry = (state: EditorState, id: string) =>
  (imageUploadKey.getState(state) ?? []).find((entry) => entry.id === id);

/** 최상위 자리 pos에 올리는 중 자리를 더한다 — 문서는 그대로다(메타만) */
export function startImageUpload(id: string, pos: number): Command {
  return (state, dispatch) => {
    if (!hasPlugin(state) || !isTopGap(state.doc, pos) || findEntry(state, id) !== undefined) {
      return false;
    }
    dispatch?.(state.tr.setMeta(imageUploadKey, { type: "start", id, pos } satisfies UploadMeta));
    return true;
  };
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
    const image = imageType.create({
      src: attrs.src,
      alt: attrs.alt,
      naturalWidth: size.width,
      naturalHeight: size.height,
    });
    const tr = state.tr
      .insert(gap, image)
      .setMeta(imageUploadKey, { type: "remove", id } satisfies UploadMeta);
    if (!entry.isTouched) {
      tr.setSelection(NodeSelection.create(tr.doc, gap)).scrollIntoView();
    }
    dispatch(tr);
    return true;
  };
}
