import { useCallback } from "react";
import type { Editor } from "@tiptap/react";
import type { Command } from "@tiptap/pm/state";

/**
 * editor-core의 ProseMirror 커맨드를 에디터에 돌린다. 패널 버튼을 누르면 편집 영역이 초점을 잃으므로
 * 초점을 되돌린 뒤 실행한다 — 선택은 EditorState에 남아 있다.
 * https://tiptap.dev/docs/editor/api/commands#chain-commands · https://tiptap.dev/docs/editor/api/commands/command
 */
export function useEditorCommand(editor: Editor): (command: Command) => boolean {
  return useCallback(
    (command: Command) =>
      editor
        .chain()
        .focus()
        .command(({ state, dispatch }) => command(state, dispatch))
        .run(),
    [editor],
  );
}
