import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostFile } from "@blog-editor/content-schema";
import type { AiUndoStore } from "../ai-undo-store";
import { serialize } from "../revision";
import { serialized } from "../serialized";

const AI_UNDO = "ai_undo";

interface AiUndoRow {
  before_body: string | null;
  after_revision: string;
}

/**
 * 배포용 ai-undo 저장소(ADR-041 · ADR-044) — `ai_undo` 표, 워크스페이스 · slug마다 한 행. `before`는 글 저장소와
 * 같은 텍스트 모양으로 둔다. 조건부 지우기는 `after_revision`까지 건 delete 한 문장이라 확인과 지우기 사이에 틈이 없다.
 */
export function createSupabaseAiUndoStore(options: {
  client: SupabaseClient;
  workspaceId: string;
}): AiUndoStore {
  const { client, workspaceId } = options;
  const table = () => client.from(AI_UNDO);
  // 같은 slug의 쓰기 · 지우기는 부른 순서대로 보낸다(file-ai-undo-store와 같은 직렬화) — 요청이 따로 날아가면
  // 늦게 부른 판이 먼저 도착해 옛 판이 남을 수 있다
  const queueKey = (slug: string) => `supabase:${AI_UNDO}:${workspaceId}/${slug}`;

  return {
    async get(slug) {
      const { data } = await table()
        .select("before_body, after_revision")
        .eq("workspace_id", workspaceId)
        .eq("slug", slug)
        .maybeSingle()
        .throwOnError();
      const row = data as AiUndoRow | null;
      if (row === null) return null;
      return {
        before: row.before_body === null ? null : (JSON.parse(row.before_body) as PostFile),
        after: row.after_revision,
      };
    },
    put(slug, entry) {
      return serialized(queueKey(slug), async () => {
        await table()
          .upsert(
            {
              workspace_id: workspaceId,
              slug,
              before_body: entry.before === null ? null : serialize(entry.before),
              after_revision: entry.after,
            },
            { onConflict: "workspace_id,slug" },
          )
          .throwOnError();
      });
    },
    delete(slug, after) {
      return serialized(queueKey(slug), async () => {
        let query = table().delete().eq("workspace_id", workspaceId).eq("slug", slug);
        if (after !== undefined) query = query.eq("after_revision", after);
        await query.throwOnError();
      });
    },
  };
}
