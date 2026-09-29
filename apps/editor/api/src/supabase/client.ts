import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/** 서버(비밀 키) 전용 클라이언트 — 세션을 저장하거나 갱신하지 않는다(요청마다 켜지는 함수 · 테스트) */
export function createSupabaseServerClient(options: {
  url: string;
  secretKey: string;
}): SupabaseClient {
  return createClient(options.url, options.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
