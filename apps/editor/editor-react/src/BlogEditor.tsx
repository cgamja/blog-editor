import { EditorContent, type Editor } from "@tiptap/react";

export interface BlogEditorProps {
  editor: Editor;
}

/**
 * 본문 편집 영역. `post-body`는 공개 HTML과 같은 본문 CSS(content-render post.css)를 받기 위한 클래스다.
 * 접근성 이름은 바깥 div가 아니라 contenteditable에 붙는다(useBlogEditor의 label).
 */
export function BlogEditor({ editor }: BlogEditorProps) {
  return <EditorContent editor={editor} className="blog-editor post-body" />;
}
