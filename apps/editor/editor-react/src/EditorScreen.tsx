import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { BlogEditor } from "./BlogEditor";
import { DecorationPanel } from "./DecorationPanel";
import type { StickerId } from "./decoration-types";
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
  stickerSrc?: (id: StickerId) => string;
  initialTab?: SideTab;
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
  stickerSrc,
  initialTab = "decorate",
}: EditorScreenProps) {
  return (
    <div className="editor-screen">
      <ScreenHeader actions={actions} status={status} />
      <main className="editor-screen-body">
        <article className="editor-screen-paper">
          <BlogEditor editor={editor} />
          <WidthToolbar editor={editor} />
        </article>
      </main>
      <SideTabs
        initialTab={initialTab}
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
