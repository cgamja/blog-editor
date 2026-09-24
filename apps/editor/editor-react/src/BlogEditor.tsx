import { useRef } from "react";
import { EditorContent, type Editor } from "@tiptap/react";
import { BlockHandles } from "./BlockHandles";
import { LinkPopover } from "./LinkPopover";
import { SlashMenu } from "./SlashMenu";
import { StickerLayer } from "./StickerLayer";
import { TextToolbar } from "./TextToolbar";
import { WidthResizeHandles } from "./WidthResizeHandles";

export interface BlogEditorProps {
  editor: Editor;
}

/**
 * 본문 편집 영역. `post-body`는 공개 HTML과 같은 본문 CSS(content-render post.css)를 받기 위한 클래스다.
 * 접근성 이름은 바깥 div가 아니라 contenteditable에 붙는다(useBlogEditor의 label).
 * 바깥 틀은 블록 손잡이 · 스티커 오버레이 · 폭 손잡이를 띄우는 기준 좌표다(position: relative, editor.css).
 * 둘 다 ProseMirror DOM 밖 형제로 둔다(sticker-drag design.md 1).
 */
export function BlogEditor({ editor }: BlogEditorProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={frameRef} className="blog-editor-frame">
      <EditorContent editor={editor} className="blog-editor post-body" />
      <BlockHandles editor={editor} frameRef={frameRef} />
      <StickerLayer editor={editor} />
      <WidthResizeHandles editor={editor} />
      <TextToolbar editor={editor} frameRef={frameRef} />
      <LinkPopover editor={editor} frameRef={frameRef} />
      <SlashMenu editor={editor} frameRef={frameRef} />
    </div>
  );
}
