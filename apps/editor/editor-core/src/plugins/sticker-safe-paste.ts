import type { Node, Slice } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { keepStickersOnOnePiece } from "../commands/split-block";
import { pastedImageFiles } from "./image-file-input";

/**
 * 붙여넣기가 스티커 있는 최상위 블록을 나눠도 스티커는 한 조각에만 남긴다(spec: editor-paste, #126 — Enter의
 * splitBlockKeepingStickers와 같은 규칙). 기본 붙여넣기(prosemirror-view 1.42.5 doPaste)는 교체만 하고 dispatch하므로
 * 뒤 조각에 스티커가 복제되고, 합이 글 하나 상한을 넘으면 blockGuard(filterTransaction)가 붙여넣기를 통째로 거부한다.
 * appendTransaction은 거부된 트랜잭션 뒤에는 돌지 않으므로, 나누게 되는 붙여넣기만 handlePaste에서 같은 교체를 만들고
 * 조각을 고쳐 한 트랜잭션으로 보낸다. 나누지 않는 붙여넣기는 기본 동작에 맡긴다.
 * 끌어 놓기는 다루지 않는다 — prosemirror-view 1.42.5 handleDrop은 dropPoint(prosemirror-transform 1.12.1)로 닫힌
 * 블록 조각을 블록 경계에 넣어 나누지 않고, 열린 조각의 뒤 조각은 놓은 블록의 속성을 가진다.
 * 근거: https://prosemirror.net/docs/ref/#view.EditorProps.handlePaste ·
 * https://prosemirror.net/docs/ref/#state.PluginSpec.filterTransaction ·
 * https://prosemirror.net/docs/ref/#transform.dropPoint
 */

export const stickerSafePasteKey = new PluginKey("stickerSafePaste");

/** 기본 붙여넣기가 한 노드로 넣는 조각 — prosemirror-view 1.42.5 sliceSingleNode와 같다 */
function singleNodeOf(slice: Slice): Node | null {
  return slice.openStart === 0 && slice.openEnd === 0 && slice.content.childCount === 1
    ? slice.content.firstChild
    : null;
}

/**
 * 기본 붙여넣기와 같은 교체 — 닫힌 노드 하나면 replaceSelectionWith, 아니면 replaceSelection. 표시를 물려받는 것
 * (preferPlain)은 글자 노드에만 뜻이 있어 끈다 — 글자 노드 하나짜리 조각은 이 플러그인이 다루지 않는다.
 */
function replacePasted(state: EditorState, slice: Slice): Transaction {
  const single = singleNodeOf(slice);
  return single === null
    ? state.tr.replaceSelection(slice)
    : state.tr.replaceSelectionWith(single, false);
}

/** 붙여넣은 결과 트랜잭션 — 나뉜 조각의 스티커까지 고친 것. 상한을 미리 셀 때(sticker-clipboard)도 이것으로 센다 */
export function pasteTransaction(state: EditorState, slice: Slice): Transaction {
  return keepStickersOnOnePiece(replacePasted(state, slice), state.selection);
}

/**
 * 글자 노드 하나짜리 조각 — 블록을 나누지 않고, 기본 붙여넣기는 이때 preferPlain으로 표시 물려받기를 정한다(이
 * 플러그인은 그 값을 모른다). 그대로 기본 동작에 맡긴다.
 */
const isInlinePaste = (slice: Slice) => singleNodeOf(slice)?.isInline === true;

/**
 * 이미지 올리기(imageFileInput)가 파일로 받는 붙여넣기 — 같은 판정(pastedImageFiles)으로 양보한다. 그 플러그인은
 * editor-react가 나중에 등록해(@tiptap/core 3.31.3 Editor.registerPlugin은 기본으로 플러그인 목록 뒤에 붙인다) 이
 * 플러그인보다 늦게 묻는다 — 먼저 가져가면 파일이 올라가지 않는다. 글과 함께 온 미리보기 이미지(Word · Excel 복사)는
 * 이미지 올리기가 받지 않는 글 붙여넣기라 여기서 다룬다.
 */
const isImageFilePaste = (event: { clipboardData?: unknown }) => pastedImageFiles(event).length > 0;

export function stickerSafePaste(): Plugin {
  return new Plugin({
    key: stickerSafePasteKey,
    props: {
      handlePaste(view, event, slice) {
        // 조합 중에는 문서를 바꾸는 부수 효과를 얹지 않는다(CLAUDE.md) — 기본 붙여넣기에 맡긴다
        if (view.composing || isInlinePaste(slice) || isImageFilePaste(event)) return false;
        const tr = replacePasted(view.state, slice);
        const replaced = tr.steps.length;
        keepStickersOnOnePiece(tr, view.state.selection);
        // 조각을 고친 단계가 없으면 나뉘지 않은 것 — 기본 붙여넣기와 같다
        if (tr.steps.length === replaced) return false;
        view.dispatch(tr.scrollIntoView().setMeta("paste", true).setMeta("uiEvent", "paste"));
        return true;
      },
    },
  });
}
