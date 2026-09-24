/** 편집 화면 머리줄 동작. 넘기지 않은 동작은 누를 수 없고 이유가 붙는다(spec: editor-screen). */
export interface EditorScreenActions {
  onBack?: () => void;
  onPreview?: () => void;
  onSaveDraft?: () => void;
  onPublish?: () => void;
}

export type SideTab = "postInfo" | "decorate";
