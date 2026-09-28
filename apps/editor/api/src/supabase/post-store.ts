import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostFile } from "@blog-editor/content-schema";
import { revisionOf, serialize } from "../revision";
import { ConflictError } from "../store";
import type { PostStore } from "../store";

const POSTS = "posts";
/** Postgres 고유 제약 위반 — 없는 줄 알고 넣었는데 이미 있는 글 */
const UNIQUE_VIOLATION = "23505";

interface PostRow {
  slug: string;
  body: string;
}

/**
 * 배포용 글 저장소(ADR-044) — `posts` 표 한 행이 파일 저장소의 `workspaces/<id>/posts/<slug>.json` 하나다.
 * body는 파일 저장소가 디스크에 쓰는 텍스트 그대로라 revision 규칙이 같다(revision.ts). revision 확인과 쓰기는
 * 조건부 insert · update · delete 한 문장이라 DB 안에서 한 번에 일어난다 — 같은 revision 동시 쓰기는 하나만 성공한다.
 */
export function createSupabasePostStore(options: {
  client: SupabaseClient;
  workspaceId: string;
}): PostStore {
  const { client, workspaceId } = options;
  const posts = () => client.from(POSTS);

  return {
    async list() {
      const { data } = await posts()
        .select("slug, body")
        .eq("workspace_id", workspaceId)
        .throwOnError();
      return (data as PostRow[]).map(({ slug, body }) => ({
        slug,
        meta: (JSON.parse(body) as PostFile).meta,
      }));
    },
    async get(slug) {
      const { data } = await posts()
        .select("body, revision")
        .eq("workspace_id", workspaceId)
        .eq("slug", slug)
        .maybeSingle()
        .throwOnError();
      const row = data as { body: string; revision: string } | null;
      if (row === null) return null;
      return { file: JSON.parse(row.body) as PostFile, revision: row.revision };
    },
    async put(slug, file, revision) {
      const body = serialize(file);
      const next = revisionOf(body);
      if (revision === null) {
        const { error } = await posts().insert({
          workspace_id: workspaceId,
          slug,
          body,
          revision: next,
        });
        if (error?.code === UNIQUE_VIOLATION) throw new ConflictError(slug);
        if (error !== null) throw error;
        return { revision: next };
      }
      const { data } = await posts()
        .update({ body, revision: next, updated_at: new Date().toISOString() })
        .eq("workspace_id", workspaceId)
        .eq("slug", slug)
        .eq("revision", revision)
        .select("slug")
        .throwOnError();
      // 0행 = 없는 글이거나 그사이 다른 쓰기가 revision을 바꿨다
      if (data.length === 0) throw new ConflictError(slug);
      return { revision: next };
    },
    async delete(slug, revision) {
      const { data } = await posts()
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("slug", slug)
        .eq("revision", revision)
        .select("slug")
        .throwOnError();
      if (data.length === 0) throw new ConflictError(slug);
    },
  };
}
