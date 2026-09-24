import { useState } from "react";
import { useBlogEditor } from "@blog-editor/editor-react";
import { EDITOR_MESSAGES } from "../messages";
import type { EditingStart } from "../types";
import { LoadedPostEditor } from "./LoadedPostEditor";

export interface PostEditorProps {
  /** 처음 한 번만 읽는다 — 뒤의 진실은 에디터와 저장 흐름이다 */
  initialStart: EditingStart;
  onAdopt: (slug: string) => void;
  /** 「내 글을 복사해 두고 최신 글 열기」 — 최신 글로 에디터를 새로 만든다 */
  onReload: (slug: string) => void;
}

/**
 * 편집 화면 한 벌. 에디터는 마운트 effect에서 생기므로(useBlogEditor, #108) 생긴 뒤에 본체를 그린다.
 */
export function PostEditor({ initialStart, onAdopt, onReload }: PostEditorProps) {
  const [start] = useState(initialStart);
  const handle = useBlogEditor({
    doc: start.doc,
    key: "post",
    label: EDITOR_MESSAGES.bodyLabel,
  });
  if (handle === null) return null;
  return <LoadedPostEditor start={start} handle={handle} onAdopt={onAdopt} onReload={onReload} />;
}
