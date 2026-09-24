import type { ReactNode } from "react";
import { POSTS_MESSAGES } from "../messages";

/** 글이 0편일 때(결정 아티팩트 2 · A안) — 동작(목록 머리와 같은 이름의 세 길)은 부르는 쪽이 넣는다 */
export function EmptyPosts({ children }: { children: ReactNode }) {
  return (
    <section className="post-empty">
      <p className="postit postit--note">{POSTS_MESSAGES.empty.note}</p>
      <p className="post-empty__body">{POSTS_MESSAGES.empty.body}</p>
      {children}
    </section>
  );
}
