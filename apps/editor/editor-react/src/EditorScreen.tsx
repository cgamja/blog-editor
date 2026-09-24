import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { BlogEditor } from "./BlogEditor";
import { DecorationPanel } from "./DecorationPanel";
import type { StickerId } from "./decoration-types";
import type { ImageUploader } from "./image-upload-types";
import { ScreenHeader } from "./ScreenHeader";
import { screenMessages } from "./screen-messages";
import type { EditorScreenActions, SideTab } from "./screen-types";
import { SideTabs } from "./SideTabs";
import { WidthToolbar } from "./WidthToolbar";

export interface EditorScreenProps {
  editor: Editor;
  actions?: EditorScreenActions;
  /** 머리줄 가운데의 저장 상태 문장 */
  status?: ReactNode;
  /** 「글 정보」 탭 내용 — 없으면 자리 표시 문장 */
  postInfo?: ReactNode;
  /** 종이 위 본문 앞(글 제목 · 안내 포스트잇) — 제목은 문서가 아니라 글 정보라 화면이 채운다 */
  title?: ReactNode;
  /** 머리줄 아래 전체 폭 알림 띠(예: 세션 만료) — 없으면 자리를 차지하지 않는다 */
  banner?: ReactNode;
  stickerSrc?: (id: StickerId) => string;
  initialTab?: SideTab;
  /** 옆 패널 탭을 바깥에서 고른다(「꾸미기 열기」). 없으면 틀이 스스로 고른다 */
  tab?: SideTab;
  onTabChange?: (tab: SideTab) => void;
  /** 이미지 올리기 — 없으면 이미지 넣기 길을 열지 않는다(BlogEditorProps.uploadImage) */
  uploadImage?: ImageUploader | undefined;
}

const NO_ACTIONS: EditorScreenActions = {};

/**
 * 편집 화면 틀(디자인 02 · 03, Figma 68:2 · 69:2, spec: editor-screen) — 머리줄 · 종이 · 옆 패널 탭을
 * 조합만 한다. 머리줄 동작과 글 정보 내용은 화면(web, M3)이 채운다. 본문 영역이 `<main>`이라 화면이 따로 감싸지 않는다.
 */
export function EditorScreen({
  editor,
  actions = NO_ACTIONS,
  status,
  postInfo,
  title,
  banner,
  stickerSrc,
  initialTab = "decorate",
  tab,
  onTabChange,
  uploadImage,
}: EditorScreenProps) {
  return (
    <div className="editor-screen">
      <ScreenHeader actions={actions} status={status} />
      {banner !== undefined && <div className="editor-screen-banner">{banner}</div>}
      <main className="editor-screen-body">
        <article className="editor-screen-paper">
          {title}
          <BlogEditor editor={editor} uploadImage={uploadImage} />
          <WidthToolbar editor={editor} />
        </article>
      </main>
      <SideTabs
        initialTab={initialTab}
        tab={tab}
        onTabChange={onTabChange}
        postInfo={
          postInfo ?? (
            <p className="editor-screen-placeholder">{screenMessages.postInfoPlaceholder}</p>
          )
        }
        decorate={
          <DecorationPanel editor={editor} {...(stickerSrc === undefined ? {} : { stickerSrc })} />
        }
      />
    </div>
  );
}
