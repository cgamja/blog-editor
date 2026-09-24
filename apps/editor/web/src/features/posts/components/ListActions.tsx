import { Link, useSearchParams } from "react-router";
import { ROUTES } from "../../../shared/routes/constants";
import { DIALOG_PARAM } from "../constants";
import { POSTS_MESSAGES } from "../messages";
import type { ListDialog, ListDialogComponents } from "../types";

interface ListActionsProps {
  dialogs: ListDialogComponents;
  /** 빈 목록 안내에서는 새 글이 앞에 온다(A안) — 목록 머리는 디자인대로 AI로 쓰기 · 가져오기 · 새 글 */
  order: "header" | "empty";
}

const DIALOG_ACTIONS: readonly { dialog: ListDialog; label: string }[] = [
  { dialog: "write-ai", label: POSTS_MESSAGES.actions.writeWithAi },
  { dialog: "import", label: POSTS_MESSAGES.actions.import },
];

/** 목록의 세 동작 — 대화상자 둘은 `?dialog=`를 여는 링크, 꽂힌 대화상자가 없으면 비활성 버튼 */
export function ListActions({ dialogs, order }: ListActionsProps) {
  const [searchParams] = useSearchParams();

  const dialogLink = (dialog: ListDialog) => {
    const next = new URLSearchParams(searchParams);
    next.set(DIALOG_PARAM, dialog);
    return `?${next.toString()}`;
  };

  const dialogActions = DIALOG_ACTIONS.map(({ dialog, label }) =>
    dialogs[dialog] === undefined ? (
      <button
        key={dialog}
        type="button"
        className="app-button"
        disabled
        title={POSTS_MESSAGES.dialogNotReady}
      >
        {label}
      </button>
    ) : (
      <Link key={dialog} className="app-button" to={dialogLink(dialog)}>
        {label}
      </Link>
    ),
  );
  const newPost = (
    <Link key="new" className="app-button app-button--primary" to={ROUTES.newPost}>
      {POSTS_MESSAGES.actions.newPost}
    </Link>
  );

  return (
    <div className="post-actions">
      {order === "header" ? [...dialogActions, newPost] : [newPost, ...dialogActions.reverse()]}
    </div>
  );
}
