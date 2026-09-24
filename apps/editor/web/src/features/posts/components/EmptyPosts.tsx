import { POSTS_MESSAGES } from "../messages";
import type { ListDialogComponents } from "../types";
import { ListActions } from "./ListActions";

/** 글이 0편일 때(결정 아티팩트 2 · A안) — 목록 머리와 같은 이름의 세 길 */
export function EmptyPosts({ dialogs }: { dialogs: ListDialogComponents }) {
  return (
    <section className="post-empty">
      <p className="postit">{POSTS_MESSAGES.empty.note}</p>
      <p className="post-empty__body">{POSTS_MESSAGES.empty.body}</p>
      <ListActions dialogs={dialogs} order="empty" />
    </section>
  );
}
