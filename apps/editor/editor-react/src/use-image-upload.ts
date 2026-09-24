import { useCallback, useEffect, useRef } from "react";
import type { ChangeEvent, RefObject } from "react";
import type { Editor } from "@tiptap/react";
import type { Transaction } from "@tiptap/pm/state";
import {
  imageFileInput,
  imageFileInputKey,
  imageFilesOf,
  imageUpload,
  imageUploadKey,
  nearestTopGap,
  topGapAfterSelection,
} from "@blog-editor/editor-core";
import { placeholderRenderer } from "./image-placeholder";
import type { ImageUploader } from "./image-upload-types";
import { useUploadQueue } from "./use-upload-queue";

export interface ImageUpload {
  /** 숨은 파일 입력칸 — BlogEditor가 그린다 */
  pickerRef: RefObject<HTMLInputElement | null>;
  onPickerChange: (event: ChangeEvent<HTMLInputElement>) => void;
  /** gap(최상위 블록 사이 자리)에 넣을 파일을 고르게 한다. 생략하면 선택이 든 블록 뒤 */
  openPicker: (gap?: number) => void;
}

/**
 * 이미지 넣기(이슈 #92)의 입력 길 셋을 올리기 줄에 잇는다 — 파일 고르기(숨은 input), 붙여넣기 · 끌어다 놓기
 * (editor-core imageFileInput 플러그인), 올리는 동안의 자리 장식(imageUpload 플러그인). 올리기 자체는 받은 upload가 한다.
 * upload가 없으면(서버 없이 띄운 에디터) 아무 길도 열지 않고 null — 붙여넣기 · 드롭도 기본 동작 그대로다.
 * https://tiptap.dev/docs/editor/api/editor#register-plugin
 */
export function useImageUpload(
  editor: Editor,
  upload: ImageUploader | undefined,
): ImageUpload | null {
  const { enqueue, actions } = useUploadQueue(editor, upload);
  const pickerRef = useRef<HTMLInputElement>(null);
  const pickerGap = useRef<number | null>(null);
  const canUpload = upload !== undefined;

  useEffect(() => {
    if (!canUpload) return undefined;
    editor.registerPlugin(imageUpload(placeholderRenderer(actions)));
    editor.registerPlugin(imageFileInput<File>({ onFiles: enqueue }));
    return () => {
      editor.unregisterPlugin(imageFileInputKey);
      editor.unregisterPlugin(imageUploadKey);
    };
  }, [editor, actions, enqueue, canUpload]);

  // 파일 창이 열려 있는 동안 앞 업로드가 끝나거나 글이 바뀌면 고른 자리가 블록 안으로 밀린다 — 트랜잭션마다
  // 매핑해 둔다(뒤 블록 쪽에 붙는다, 자리 장식과 같은 방향)
  useEffect(() => {
    const follow = ({ transaction }: { transaction: Transaction }) => {
      if (pickerGap.current !== null && transaction.docChanged) {
        pickerGap.current = transaction.mapping.map(pickerGap.current, 1);
      }
    };
    editor.on("transaction", follow);
    return () => void editor.off("transaction", follow);
  }, [editor]);

  const openPicker = useCallback(
    (gap?: number) => {
      pickerGap.current = gap ?? topGapAfterSelection(editor.state);
      pickerRef.current?.click();
    },
    [editor],
  );

  const onPickerChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const picked = imageFilesOf(Array.from(event.target.files ?? []));
      // 같은 파일을 다시 고를 수 있게 비운다
      event.target.value = "";
      const gap = pickerGap.current;
      pickerGap.current = null;
      // 고른 파일은 조용히 버리지 않는다 — 매핑된 자리가 블록 안이면 가장 가까운 블록 사이 자리로 옮긴다
      if (gap !== null) enqueue(picked, nearestTopGap(editor.state.doc, gap, false));
    },
    [editor, enqueue],
  );

  return canUpload ? { pickerRef, onPickerChange, openPicker } : null;
}
