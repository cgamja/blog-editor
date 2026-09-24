import { useMemo, useRef } from "react";
import { EditorContent, type Editor } from "@tiptap/react";
import { BlockHandles } from "./BlockHandles";
import { LinkPopover } from "./LinkPopover";
import { SlashMenu } from "./SlashMenu";
import { StickerLayer } from "./StickerLayer";
import { TextToolbar } from "./TextToolbar";
import type { ImageUploader } from "./image-upload-types";
import { useImageUpload } from "./use-image-upload";
import { WidthResizeHandles } from "./WidthResizeHandles";

export interface BlogEditorProps {
  editor: Editor;
  /**
   * 이미지 한 장을 올리는 함수(web은 TanStack Query 뮤테이션). editor-react는 서버를 모른다 — 없으면 이미지 넣기
   * 길(「+」 · `/` 메뉴 「이미지」, 붙여넣기 · 끌어다 놓기)을 열지 않는다(spec: editor-image-insert)
   */
  uploadImage?: ImageUploader | undefined;
}

/**
 * 본문 편집 영역. `post-body`는 공개 HTML과 같은 본문 CSS(content-render post.css)를 받기 위한 클래스다.
 * 접근성 이름은 바깥 div가 아니라 contenteditable에 붙는다(useBlogEditor의 label).
 * 바깥 틀은 블록 손잡이 · 스티커 오버레이 · 폭 손잡이를 띄우는 기준 좌표다(position: relative, editor.css).
 * 둘 다 ProseMirror DOM 밖 형제로 둔다(sticker-drag design.md 1).
 */
export function BlogEditor({ editor, uploadImage }: BlogEditorProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const images = useImageUpload(editor, uploadImage);
  const openPicker = images?.openPicker;
  const actions = useMemo(
    () => (openPicker === undefined ? {} : { image: openPicker }),
    [openPicker],
  );
  return (
    <div ref={frameRef} className="blog-editor-frame">
      <EditorContent editor={editor} className="blog-editor post-body" />
      <BlockHandles editor={editor} frameRef={frameRef} actions={actions} />
      {images !== null && (
        <input
          ref={images.pickerRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={images.onPickerChange}
        />
      )}
      <StickerLayer editor={editor} />
      <WidthResizeHandles editor={editor} />
      <TextToolbar editor={editor} frameRef={frameRef} />
      <LinkPopover editor={editor} frameRef={frameRef} />
      <SlashMenu editor={editor} frameRef={frameRef} />
    </div>
  );
}
