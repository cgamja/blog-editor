/**
 * Supabase 계약 층(supabase-store · ADR-044)의 시험 프로젝트 준비 — 여러 Supabase 테스트 파일이 같이 쓴다.
 * 시험 키가 없으면 env가 null이고 각 파일은 `describe.skipIf(supabaseTestEnv === null)`로 층만 건너뛴다.
 * 공유 DB라서 쓴 워크스페이스 · 이미지 · OAuth · 잠금 키를 기록해 두었다가 afterAll에 지운다.
 */
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "./client";

export interface SupabaseTestEnv {
  url: string;
  secretKey: string;
  publishableKey: string;
}

const ENV_FILE = fileURLToPath(new URL("../../../../../.env", import.meta.url));
const SKIP_REASON = "시험 키 없음 — SUPABASE_TEST_* 필요";
const IMAGE_BUCKET = "images";

/** 레포 루트 `.env`는 선택이다 — 이미 있는 env가 이기고, 파일이 없으면 셸 env만 본다 */
function loadRepoEnvFile(): void {
  try {
    process.loadEnvFile(ENV_FILE);
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}

function readSupabaseTestEnv(): SupabaseTestEnv | null {
  loadRepoEnvFile();
  const url = process.env.SUPABASE_TEST_URL;
  const secretKey = process.env.SUPABASE_TEST_SECRET_KEY;
  const publishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
  if (!url || !secretKey || !publishableKey) return null;
  return { url, secretKey, publishableKey };
}

export const supabaseTestEnv = readSupabaseTestEnv();

/** 건너뛸 때 이유가 테스트 이름에 보이게 */
export function supabaseSuiteName(name: string): string {
  return supabaseTestEnv === null ? `${name} (건너뜀: ${SKIP_REASON})` : name;
}

function requireEnv(): SupabaseTestEnv {
  if (supabaseTestEnv === null) throw new Error(SKIP_REASON);
  return supabaseTestEnv;
}

/** 부를 때마다 새 서버 클라이언트 — "함수가 새로 켜짐"을 흉내 낼 때도 쓴다 */
export function createTestServerClient(): SupabaseClient {
  const { url, secretKey } = requireEnv();
  return createSupabaseServerClient({ url, secretKey });
}

async function removeRows(client: SupabaseClient, table: string, column: string, keys: string[]) {
  if (keys.length === 0) return;
  const { error } = await client.from(table).delete().in(column, keys);
  if (error !== null) throw new Error(`${table} 정리 실패: ${error.message}`);
}

/**
 * describe 안에서 부른다. 새 id를 발급하고 기록해 두었다가 afterAll에 지운다.
 * 이미지 객체는 버킷 `images`의 맨 위(`<이름>`)에 있다고 본다.
 */
export function useSupabaseTestData() {
  const workspaces: string[] = [];
  const images: string[] = [];
  const oauthClients: string[] = [];
  const oauthCodes: string[] = [];
  const lockoutKeys: string[] = [];

  afterAll(async () => {
    if (supabaseTestEnv === null) return;
    const client = createTestServerClient();
    for (const table of ["posts", "workspace_settings", "ai_undo"]) {
      await removeRows(client, table, "workspace_id", workspaces);
    }
    await removeRows(client, "oauth_clients", "client_id", oauthClients);
    await removeRows(client, "oauth_codes", "code_hash", oauthCodes);
    await removeRows(client, "login_lockouts", "key", lockoutKeys);
    if (images.length > 0) {
      const { error } = await client.storage.from(IMAGE_BUCKET).remove(images);
      if (error !== null) throw new Error(`이미지 정리 실패: ${error.message}`);
    }
  });

  const track = (list: string[]) => (value: string) => {
    list.push(value);
    return value;
  };

  return {
    newWorkspaceId: () => track(workspaces)(`test-${randomUUID()}`),
    newLockoutKey: () => track(lockoutKeys)(`test-${randomUUID()}`),
    trackImage: track(images),
    trackOAuthClient: track(oauthClients),
    trackOAuthCode: track(oauthCodes),
  };
}
