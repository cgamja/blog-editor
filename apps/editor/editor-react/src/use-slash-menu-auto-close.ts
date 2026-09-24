import { useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { closeSlashMenu } from "@blog-editor/editor-core";
import { useCommandRunner } from "./use-command-runner";

/**
 * 메뉴를 찾는 중이 아니게 되면 슬래시 메뉴를 닫는다. 입력한 글자는 그대로 둔다(spec: editor-slash-menu).
 * - 걸러서 남은 항목이 없을 때
 * - 편집 영역이 포커스를 잃었을 때 — 항목 누르기는 mousedown을 막아 포커스가 남으므로 여기에 걸리지 않는다
 */
export function useSlashMenuAutoClose(
  editor: Editor,
  query: string | null,
  itemCount: number,
): void {
  const run = useCommandRunner(editor);

  useEffect(() => {
    if (query !== null && itemCount === 0) run(closeSlashMenu);
  }, [query, itemCount, run]);

  useEffect(() => {
    const dom = editor.view.dom;
    const close = () => run(closeSlashMenu);
    dom.addEventListener("blur", close);
    return () => dom.removeEventListener("blur", close);
  }, [editor, run]);
}
