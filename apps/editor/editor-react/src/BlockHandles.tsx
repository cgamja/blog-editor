import { useCallback, useState } from "react";
import type { RefObject } from "react";
import type { Editor } from "@tiptap/react";
import type { Command } from "@tiptap/pm/state";
import { insertBlockAfter, moveTopBlockTo } from "@blog-editor/editor-core";
import type { InsertableBlockKind } from "@blog-editor/editor-core";
import { BlockAddMenu } from "./BlockAddMenu";
import { BlockMoveHandle } from "./BlockMoveHandle";
import { useHoveredBlock } from "./use-hovered-block";

export interface BlockHandlesProps {
  editor: Editor;
  frameRef: RefObject<HTMLDivElement | null>;
}

/**
 * 블록 손잡이 줄(디자인 68:2, 이슈 #59) — 마우스를 올린 최상위 블록 왼쪽에 「블록 추가」 · 「블록 옮기기」를
 * 둔다. 문서를 바꾸는 일은 editor-core 커맨드 한 번이고, 여기는 어느 블록 옆에 띄울지만 정한다.
 */
export function BlockHandles({ editor, frameRef }: BlockHandlesProps) {
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useHoveredBlock(editor, frameRef, dragging || menuOpen);

  const runAndDropHandle = useCallback(
    (command: Command) => {
      // 문서가 바뀌면 블록 자리도 바뀐다 — 옛 자리의 손잡이를 남기지 않는다
      setHovered(null);
      editor
        .chain()
        .focus()
        .command(({ state, dispatch }) => command(state, dispatch))
        .run();
    },
    [editor, setHovered],
  );

  const onDrop = useCallback(
    (from: number, gap: number) => runAndDropHandle(moveTopBlockTo(from, gap)),
    [runAndDropHandle],
  );

  if (hovered === null || !editor.isEditable) return null;

  const onChoose = (kind: InsertableBlockKind) => {
    // 한글 조합 중에는 문서를 바꾸지 않는다 — 메뉴를 열어 둔 채 미룬다(.claude/rules/editor.md)
    if (editor.view.composing) return;
    setMenuOpen(false);
    runAndDropHandle(insertBlockAfter(hovered.index, kind));
  };

  return (
    <div className="block-handles" style={{ top: hovered.top, left: hovered.left }}>
      <BlockAddMenu open={menuOpen} onOpenChange={setMenuOpen} onChoose={onChoose} />
      <BlockMoveHandle
        editor={editor}
        frameRef={frameRef}
        from={hovered.index}
        onDraggingChange={setDragging}
        onDrop={onDrop}
      />
    </div>
  );
}
