import type { SupabaseClient } from "@supabase/supabase-js";
import { IDLE_SITE_REBUILD } from "../site-rebuild-store";
import type { SiteRebuildState, SiteRebuildStatus, SiteRebuildStore } from "../site-rebuild-store";

const SITE_REBUILDS = "site_rebuilds";

interface SiteRebuildRow {
  status: SiteRebuildStatus;
  request_id: string | null;
  updated_at: string | null;
}

/** 배포용 재빌드 상태 저장소(ADR-047) — `site_rebuilds` 표 한 행. 마지막 쓰기가 이긴다(site-rebuild-store 계약) */
export function createSupabaseSiteRebuildStore(options: {
  client: SupabaseClient;
  workspaceId: string;
}): SiteRebuildStore {
  const { client, workspaceId } = options;
  const table = () => client.from(SITE_REBUILDS);

  return {
    async get() {
      const { data } = await table()
        .select("status, request_id, updated_at")
        .eq("workspace_id", workspaceId)
        .maybeSingle()
        .throwOnError();
      const row = data as SiteRebuildRow | null;
      if (row === null) return { ...IDLE_SITE_REBUILD };
      return {
        status: row.status,
        requestId: row.request_id,
        // timestamptz는 `+00:00` 꼴로 돌아온다 — 쓴 모양(toISOString)으로 되돌린다
        updatedAt: row.updated_at === null ? null : new Date(row.updated_at).toISOString(),
      };
    },
    async put(state: SiteRebuildState) {
      await table()
        .upsert(
          {
            workspace_id: workspaceId,
            status: state.status,
            request_id: state.requestId,
            updated_at: state.updatedAt,
          },
          { onConflict: "workspace_id" },
        )
        .throwOnError();
    },
  };
}
