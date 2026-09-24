import { EditorContent, type Editor } from "@tiptap/react";

export interface BlogEditorProps {
  editor: Editor;
  /** 스크린리더가 읽는 편집 영역 이름 */
  label: string;
}

/** 본문 편집 영역. `post-body`는 공개 HTML과 같은 본문 CSS(content-render post.css)를 받기 위한 클래스다. */
export function BlogEditor({ editor, label }: BlogEditorProps) {
  return <EditorContent editor={editor} className="blog-editor post-body" aria-label={label} />;
}
