import { useCallback } from "react";
import type { Editor } from "@tiptap/react";
import type { Command } from "@tiptap/pm/state";

/**
 * editor-core의 ProseMirror 커맨드를 이 에디터에 돌리는 함수를 돌려준다. 초점은 옮기지 않는다 —
 * 패널 select를 화살표로 고르는 키보드 사용자를 편집 영역으로 쫓아내지 않고, 스크롤도 일으키지 않는다.
 * 편집 영역이 초점을 잃어도 선택은 EditorState에 남아 커맨드가 그 선택에 적용된다.
 * https://tiptap.dev/docs/editor/api/commands/command
 */
export function useCommandRunner(editor: Editor): (command: Command) => boolean {
  return useCallback(
    (command: Command) =>
      editor.commands.command(({ state, dispatch }) => command(state, dispatch)),
    [editor],
  );
}
