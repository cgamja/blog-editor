import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ChangeEvent, RefObject } from "react";
import type { Editor } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import {
  cancelImageUpload,
  failImageUpload,
  finishImageUpload,
  imageUpload,
  imageUploadKey,
  imageUploadsOf,
  nearestTopGap,
  startImageUpload,
  topGapAfterSelection,
} from "@blog-editor/editor-core";
import { prepareImage } from "./encode-image";
import { imageFilesOf } from "./image-insert-model";
import { placeholderRenderer } from "./image-placeholder";
import { uploadImage } from "./upload-image";

export interface ImageUpload {
  /** 숨은 파일 입력칸 — BlogEditor가 그린다 */
  pickerRef: RefObject<HTMLInputElement | null>;
  onPickerChange: (event: ChangeEvent<HTMLInputElement>) => void;
  /** gap(최상위 블록 사이 자리)에 넣을 파일을 고르게 한다. 생략하면 선택이 든 블록 뒤 */
  openPicker: (gap?: number) => void;
}

const fileInputKey = new PluginKey("imageFileInput");

/** 한글 조합 중에는 문서를 바꾸지 않는다 — 조합이 끝난 뒤로 미룬다(.claude/rules/editor.md) */
function afterComposition(view: EditorView): Promise<void> {
  if (!view.composing) return Promise.resolve();
  return new Promise((resolve) => {
    // compositionend 직후 ProseMirror가 조합 결과를 먼저 반영하도록 한 틱 뒤에 푼다
    view.dom.addEventListener("compositionend", () => setTimeout(resolve, 0), { once: true });
  });
}

/** 놓은 좌표의 최상위 블록 위 · 아래 절반으로 자리를 고른다 */
function dropGap(view: EditorView, event: DragEvent): number | null {
  // https://prosemirror.net/docs/ref/#view.EditorView.posAtCoords
  const found = view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (found === null) return null;
  const { doc } = view.state;
  const $pos = doc.resolve(found.pos);
  if ($pos.depth === 0) return found.pos;
  const block = view.nodeDOM($pos.before(1));
  if (!(block instanceof HTMLElement)) return nearestTopGap(doc, found.pos, false);
  const rect = block.getBoundingClientRect();
  return nearestTopGap(doc, found.pos, event.clientY < rect.top + rect.height / 2);
}

/**
 * 이미지 넣기(이슈 #92) — 파일을 받아 자리(장식)를 두고, 브라우저에서 굽고, 올리고, 끝나면 그 자리에 넣는다.
 * 여러 파일은 순서대로 올린다(뒤 자리는 앞 그림 뒤로 매핑된다). 실패하면 자리에 이유와 다시 시도 · 지우기.
 * 붙여넣기 · 끌어다 놓기는 이미지 파일이 있을 때만 가로챈다 — 스티커 · 글 붙여넣기는 그대로 넘어간다.
 * https://prosemirror.net/docs/ref/#view.EditorProps.handlePaste · https://prosemirror.net/docs/ref/#view.EditorProps.handleDrop
 */
export function useImageUpload(editor: Editor): ImageUpload {
  const pickerRef = useRef<HTMLInputElement>(null);
  const pickerGap = useRef<number | null>(null);
  const files = useRef(new Map<string, File>());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const nextId = useRef(0);

  const run = useCallback(
    (command: Command) => command(editor.view.state, editor.view.dispatch),
    [editor],
  );

  const process = useCallback(
    async (id: string) => {
      const file = files.current.get(id);
      const stillThere = () => imageUploadsOf(editor.view.state).some((entry) => entry.id === id);
      if (file === undefined || !stillThere()) return;
      const prepared = await prepareImage(file);
      if (!prepared.ok) {
        run(failImageUpload(id, prepared.message));
        return;
      }
      const uploaded = await uploadImage(prepared.blob);
      if (!uploaded.ok) {
        run(failImageUpload(id, uploaded.message));
        return;
      }
      await afterComposition(editor.view);
      // 자리가 그새 지워졌으면 false — 끝난 결과는 버린다
      run(finishImageUpload(id, uploaded.attrs));
      files.current.delete(id);
    },
    [editor, run],
  );

  const enqueue = useCallback(
    (file: File, gap: number) => {
      const id = `image-${(nextId.current += 1)}`;
      if (!run(startImageUpload(id, gap))) return;
      files.current.set(id, file);
      queue.current = queue.current.then(() => process(id));
    },
    [process, run],
  );

  const insertFiles = useCallback(
    (list: readonly File[], gap: number) => {
      for (const file of imageFilesOf(list)) enqueue(file, gap);
    },
    [enqueue],
  );

  const actions = useMemo(
    () => ({
      retry: (id: string) => {
        const file = files.current.get(id);
        const entry = imageUploadsOf(editor.view.state).find((item) => item.id === id);
        if (file === undefined || entry === undefined) return;
        run(cancelImageUpload(id));
        files.current.delete(id);
        enqueue(file, entry.pos);
      },
      remove: (id: string) => {
        run(cancelImageUpload(id));
        files.current.delete(id);
      },
    }),
    [editor, enqueue, run],
  );

  useEffect(() => {
    const inputPlugin = new Plugin({
      key: fileInputKey,
      props: {
        handlePaste(view, event) {
          const pasted = imageFilesOf(Array.from(event.clipboardData?.files ?? []));
          if (pasted.length === 0) return false;
          insertFiles(pasted, topGapAfterSelection(view.state));
          return true;
        },
        handleDrop(view, event) {
          const dropped = imageFilesOf(Array.from(event.dataTransfer?.files ?? []));
          if (dropped.length === 0) return false;
          const gap = dropGap(view, event);
          if (gap !== null) insertFiles(dropped, gap);
          return true;
        },
      },
    });
    editor.registerPlugin(imageUpload(placeholderRenderer(actions)));
    editor.registerPlugin(inputPlugin);
    return () => {
      editor.unregisterPlugin(fileInputKey);
      editor.unregisterPlugin(imageUploadKey);
    };
  }, [editor, actions, insertFiles]);

  const openPicker = useCallback(
    (gap?: number) => {
      pickerGap.current = gap ?? topGapAfterSelection(editor.view.state);
      pickerRef.current?.click();
    },
    [editor],
  );

  const onPickerChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const picked = Array.from(event.target.files ?? []);
      // 같은 파일을 다시 고를 수 있게 비운다
      event.target.value = "";
      if (pickerGap.current !== null) insertFiles(picked, pickerGap.current);
      pickerGap.current = null;
    },
    [insertFiles],
  );

  return { pickerRef, onPickerChange, openPicker };
}
