import { useCallback, useEffect, useMemo, useRef } from "react";
import { isEditorComposing, useDocChange } from "@blog-editor/editor-react";
import type { BlogEditorInstance } from "@blog-editor/editor-react";
import { createAutosave } from "../autosave";
import { AUTOSAVE_DELAY_MS } from "../constants";
import type { SaveMode } from "../types";

export interface UseAutosaveOptions {
  editor: BlogEditorInstance;
  save: (mode: SaveMode) => Promise<void>;
  /** 되살린 글은 서버보다 새것이다 — 곧 저장한다 */
  shouldSaveSoon: boolean;
}

/**
 * 저장 줄을 에디터에 잇는다 — 문서가 바뀌면 시계를 맞추고, 조합 중이면 미룬다. ⌘S · 발행 · 덮어쓰기도
 * 이 줄의 `flush` · `run`으로 들어와 PUT이 겹치지 않는다.
 */
export function useAutosave({ editor, save, shouldSaveSoon }: UseAutosaveOptions) {
  const saveRef = useRef(save);
  saveRef.current = save;

  const autosave = useMemo(
    () =>
      createAutosave({
        delayMs: AUTOSAVE_DELAY_MS,
        isComposing: () => isEditorComposing(editor),
        save: (mode) => saveRef.current(mode),
      }),
    [editor],
  );

  useDocChange(
    editor,
    useCallback(() => autosave.schedule(), [autosave]),
  );

  useEffect(() => {
    if (shouldSaveSoon) autosave.schedule();
    return () => autosave.dispose();
  }, [autosave, shouldSaveSoon]);

  return autosave;
}
