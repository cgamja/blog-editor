/**
 * 배포 진입점(edge-config · edge) 테스트가 같이 쓰는 유효한 배포 env 한 벌 — 각 테스트가 한 항목씩 바꾼다.
 */
import { hashPassword } from "./password";

// 테스트 속도를 위해 낮은 N — 해시 문자열이 파라미터를 들고 다닌다
export const PASSWORD_HASH = await hashPassword("edge-test-password-long", { N: 1024 });

export const VALID_ENV: Record<string, string | undefined> = {
  ADMIN_PASSWORD_HASH: PASSWORD_HASH,
  SESSION_SECRET: "edge-session-secret-at-least-32-bytes!!",
  PUBLIC_BASE_URL: "https://editor.example.test",
  SUPABASE_URL: "https://project.supabase.co",
  EDITOR_SECRET_KEY: "sb_secret_test_key",
  RELAY_SECRET: "edge-relay-secret-test-value",
};
