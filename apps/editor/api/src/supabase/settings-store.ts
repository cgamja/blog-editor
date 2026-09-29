import type { SupabaseClient } from "@supabase/supabase-js";
import { EMPTY_SETTINGS } from "../settings-store";
import type { SettingsStore } from "../settings-store";

const WORKSPACE_SETTINGS = "workspace_settings";

/** 배포용 설정 저장소(ADR-044) — `workspace_settings` 표 한 행. 마지막 쓰기가 이긴다(settings-store 계약) */
export function createSupabaseSettingsStore(options: {
  client: SupabaseClient;
  workspaceId: string;
}): SettingsStore {
  const { client, workspaceId } = options;
  const table = () => client.from(WORKSPACE_SETTINGS);

  return {
    async get() {
      const { data } = await table()
        .select("guide")
        .eq("workspace_id", workspaceId)
        .maybeSingle()
        .throwOnError();
      const row = data as { guide: string } | null;
      return row === null ? EMPTY_SETTINGS : { guide: row.guide };
    },
    async put(settings) {
      await table()
        .upsert(
          {
            workspace_id: workspaceId,
            guide: settings.guide,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "workspace_id" },
        )
        .throwOnError();
    },
  };
}
