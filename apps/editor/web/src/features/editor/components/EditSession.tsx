import { useState } from "react";
import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../../shared/api/errors";
import { ROUTES } from "../../../shared/routes/constants";
import { fetchPost, type LoadedPost } from "../api";
import { NEW_POST_KEY, POST_QUERY_KEY } from "../constants";
import { editingStartOf } from "../editing-start";
import { readLocalDraft } from "../local-draft";
import { EDITOR_MESSAGES } from "../messages";
import { PostEditor } from "./PostEditor";

const HTTP_NOT_FOUND = 404;
const MAX_RETRIES = 3;

const postQueryKey = (slug: string) => [POST_QUERY_KEY, slug] as const;

export interface EditSessionProps {
  /** 이 세션이 연 글 — 새 글이면 null. 세션 안에서 주소가 바뀌어도 이 값은 그대로다 */
  initialSlug: string | null;
  onAdopt: (slug: string) => void;
}

interface Reloaded {
  version: number;
  slug: string;
  post: LoadedPost;
}

/**
 * 편집 세션 하나 — 글을 한 번 불러와 에디터를 만든다. 그 뒤의 진실은 에디터와 저장 흐름이라 이 쿼리를 다시
 * 읽지 않는다(`staleTime: Infinity`). 「최신 글 열기」만 최신 글로 에디터를 새로 만든다.
 */
export function EditSession({ initialSlug, onAdopt }: EditSessionProps) {
  const queryClient = useQueryClient();
  const [reloaded, setReloaded] = useState<Reloaded | null>(null);
  const query = useQuery({
    queryKey: postQueryKey(initialSlug ?? NEW_POST_KEY),
    queryFn: () => fetchPost(initialSlug ?? NEW_POST_KEY),
    enabled: initialSlug !== null,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status < 500) && failureCount < MAX_RETRIES,
  });
  // 처음 읽은 localDraft — 렌더마다 저장소를 읽지 않게 한 번만
  const [local] = useState(() => readLocalDraft(initialSlug ?? NEW_POST_KEY));

  const handleReload = (slug: string) => {
    void queryClient
      .fetchQuery({ queryKey: postQueryKey(slug), queryFn: () => fetchPost(slug), staleTime: 0 })
      .then((post) =>
        setReloaded((previous) => ({ version: (previous?.version ?? 0) + 1, slug, post })),
      );
  };

  if (reloaded !== null) {
    return (
      <PostEditor
        key={reloaded.version}
        start={editingStartOf(reloaded.post, reloaded.slug, null)}
        onAdopt={onAdopt}
        onReload={handleReload}
      />
    );
  }
  if (initialSlug === null) {
    return (
      <PostEditor
        start={editingStartOf(null, null, local)}
        onAdopt={onAdopt}
        onReload={handleReload}
      />
    );
  }
  if (query.isPending) {
    return (
      <p className="app-status" role="status">
        {EDITOR_MESSAGES.loading}
      </p>
    );
  }
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === HTTP_NOT_FOUND) {
      return (
        <main className="app-page">
          <h1>{EDITOR_MESSAGES.notFound}</h1>
          <Link to={ROUTES.home}>{EDITOR_MESSAGES.backToList}</Link>
        </main>
      );
    }
    throw query.error;
  }
  return (
    <PostEditor
      start={editingStartOf(query.data, initialSlug, local)}
      onAdopt={onAdopt}
      onReload={handleReload}
    />
  );
}
