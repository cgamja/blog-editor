import { useSearchParams } from "react-router";
import { EmptyPosts } from "../components/EmptyPosts";
import { ListActions } from "../components/ListActions";
import { PostTable } from "../components/PostTable";
import { PostTabs } from "../components/PostTabs";
import { DIALOG_PARAM, TAB_PARAM } from "../constants";
import { usePosts } from "../hooks/use-posts";
import { POSTS_MESSAGES } from "../messages";
import { countByTab, listDialogOf, postsOfTab, sortByLastEdited, tabOf } from "../post-list";
import type { ListDialogComponents } from "../types";

const NO_DIALOGS: ListDialogComponents = {};

interface PostListPageProps {
  /** 가져오기 · AI로 쓰기 대화상자 — 라우터가 꽂는다(#98). 없는 것은 버튼이 비활성 */
  dialogs?: ListDialogComponents;
}

/** 글 목록(Figma 66:2) — 탭 · 대화상자 상태는 주소(`?tab=` · `?dialog=`)에 있다 */
export function PostListPage({ dialogs = NO_DIALOGS }: PostListPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const posts = usePosts();

  if (posts.isPending) {
    return (
      <p className="app-status" role="status">
        {POSTS_MESSAGES.loading}
      </p>
    );
  }
  if (posts.isError) throw posts.error;

  const tab = tabOf(searchParams.get(TAB_PARAM));
  const openDialog = listDialogOf(searchParams.get(DIALOG_PARAM));
  const Dialog = openDialog === null ? undefined : dialogs[openDialog];
  const visible = sortByLastEdited(postsOfTab(posts.data, tab));

  const handleCloseDialog = () =>
    setSearchParams(
      (params) => {
        params.delete(DIALOG_PARAM);
        return params;
      },
      { replace: true },
    );

  return (
    <div className="post-list">
      <header className="post-list__header">
        <h1 className="page-title">{POSTS_MESSAGES.title}</h1>
        <ListActions dialogs={dialogs} order="header" />
      </header>
      {posts.data.length === 0 ? (
        <EmptyPosts dialogs={dialogs} />
      ) : (
        <>
          <PostTabs current={tab} counts={countByTab(posts.data)} />
          {visible.length === 0 ? (
            <p className="post-list__empty-tab">{POSTS_MESSAGES.emptyTab[tab]}</p>
          ) : (
            <PostTable posts={visible} />
          )}
        </>
      )}
      <p className="post-list__footer">{POSTS_MESSAGES.footer}</p>
      {Dialog === undefined ? null : <Dialog onClose={handleCloseDialog} />}
    </div>
  );
}
