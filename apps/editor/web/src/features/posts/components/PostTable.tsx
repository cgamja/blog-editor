import { Link } from "react-router";
import { editPostPath } from "../../../shared/routes/paths";
import { POSTS_MESSAGES } from "../messages";
import { isAiDraft, lastEditedLabelOf } from "../post-list";
import type { PostSummary } from "../types";

/** 글 표(Figma 66:2) — 좁은 화면에서는 카테고리 · 고친 날 열을 접는다(app.css) */
export function PostTable({ posts }: { posts: readonly PostSummary[] }) {
  const { columns, status } = POSTS_MESSAGES;
  return (
    <table className="post-table">
      <thead>
        <tr>
          <th scope="col">{columns.title}</th>
          <th scope="col" className="post-table__optional">
            {columns.category}
          </th>
          <th scope="col">{columns.status}</th>
          <th scope="col" className="post-table__optional post-table__date">
            {columns.lastEdited}
          </th>
        </tr>
      </thead>
      <tbody>
        {posts.map((post) => (
          <tr key={post.slug}>
            <td>
              <Link className="post-table__title" to={editPostPath(post.slug)}>
                {post.title}
              </Link>
              {isAiDraft(post) ? (
                <span className="postit postit--tag">{POSTS_MESSAGES.aiDraft}</span>
              ) : null}
            </td>
            <td className="post-table__optional post-table__muted">{post.category}</td>
            <td>
              <span className={post.draft ? "status-pill" : "status-pill status-pill--published"}>
                {post.draft ? status.draft : status.published}
              </span>
            </td>
            <td className="post-table__optional post-table__muted post-table__date">
              {lastEditedLabelOf(post)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
