/**
 * 배포 진입점(edge-deploy · ADR-044 · ADR-046) — `scripts/build-edge.ts`가 이 파일을 한 파일로 묶어
 * `supabase/functions/editor/`에 쓴다. 요청 경로의 첫 칸(함수 이름)을 떼고 로컬과 같은 앱 라우트로 넘긴다.
 * 앱 · 라우트는 로컬(serve.ts)과 같고 저장소 · 설정 읽기만 다르다. 본문 CSS · 형식 가이드는 text 모듈이라
 * 실행 중에 파일을 읽지 않는다. 미리보기 찍기 수단(브라우저)은 넘기지 않는다 — 함수에는 브라우저가 없다.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import postCss from "@blog-editor/content-render/post.css";
import formatGuide from "@blog-editor/content-convert/guide/format.md";
import { createApp } from "./app";
import { readEdgeConfig } from "./edge-config";
import { createMemoryAccountStore } from "./memory-account-store";
import { RELAY_ONLY_MESSAGE } from "./messages";
import { createMemoryConnectionTokenStore } from "./mcp/memory-connection-token-store";
import { DEFAULT_CATEGORIES, DEFAULT_WORKSPACE_ID, SEED_ACCOUNT_ID } from "./seed";
import { createSupabaseAiUndoStore } from "./supabase/ai-undo-store";
import { createSupabaseServerClient } from "./supabase/client";
import { createSupabaseImageStore } from "./supabase/image-store";
import { createSupabaseLoginLockout } from "./supabase/login-lockout";
import { createSupabaseOAuthStore } from "./supabase/oauth-store";
import { createSupabasePostStore } from "./supabase/post-store";
import { createSupabaseSettingsStore } from "./supabase/settings-store";
import { createSupabaseSiteRebuildStore } from "./supabase/site-rebuild-store";
import { createSiteRebuild } from "./site-rebuild";

/** Supabase Edge Runtime 전역 — 응답 뒤에도 넘긴 일을 벽시계 한도(무료 150초)까지 이어 돌린다 */
declare const EdgeRuntime: { waitUntil(task: Promise<unknown>): void };

/** 중계(Worker)가 붙이는 헤더 — relay 패키지의 RELAY_SECRET_HEADER와 같은 이름(패키지 사이 import는 없다) */
const RELAY_SECRET_HEADER = "X-Relay-Secret";

/**
 * Supabase는 함수를 `/<함수 이름>/…`로 부른다 — 첫 칸을 떼어 앱이 로컬과 같은 `/api/*` · `/mcp` 등으로 받게 한다.
 * `/editor`처럼 첫 칸만 있으면 루트(`/`)다.
 */
export function withoutFunctionPrefix(request: Request): Request {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/^\/[^/]*/, "") || "/";
  return new Request(url, request);
}

/** 길이가 달라도 시간이 같도록 해시(32바이트)끼리 비교한다 — pkce.ts와 같은 방식 */
function sameSecret(received: string | null, expected: string): boolean {
  if (received === null) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(received), digest(expected));
}

function relayOnly(): Response {
  return Response.json({ message: RELAY_ONLY_MESSAGE }, { status: 403 });
}

/** 인스턴스가 켜질 때 한 번 부른다 — 설정이 틀리면 요청을 받기 전에 멈춘다(보호 대상) */
export function createEdgeHandler(
  env: Record<string, string | undefined>,
): (request: Request) => Promise<Response> {
  const config = readEdgeConfig(env);
  const client = createSupabaseServerClient({
    url: config.supabaseUrl,
    secretKey: config.supabaseSecretKey,
  });
  const workspace = { client, workspaceId: DEFAULT_WORKSPACE_ID };
  // 30초 묶음 대기를 응답 뒤로 넘긴다 — 인스턴스가 먼저 내려가면 pending이 남고 화면의 "다시 시도"로 푼다(ADR-047)
  const siteRebuild =
    config.siteBuildHookUrl === null
      ? null
      : createSiteRebuild({
          hookUrl: config.siteBuildHookUrl,
          store: createSupabaseSiteRebuildStore(workspace),
          runLater: (task) => EdgeRuntime.waitUntil(task),
        });
  const app = createApp({
    store: createSupabasePostStore(workspace),
    images: createSupabaseImageStore({ client }),
    settings: createSupabaseSettingsStore(workspace),
    aiUndo: createSupabaseAiUndoStore(workspace),
    categories: DEFAULT_CATEGORIES,
    imageBaseUrl: config.imageBaseUrl,
    postCss,
    ...(siteRebuild === null ? {} : { siteRebuild }),
    accounts: createMemoryAccountStore([
      {
        id: SEED_ACCOUNT_ID,
        username: config.username,
        passwordHash: config.passwordHash,
        workspaceId: DEFAULT_WORKSPACE_ID,
      },
    ]),
    sessionSecret: config.sessionSecret,
    // 요청마다 다른 인스턴스가 받을 수 있다 — 잠금 카운터는 메모리가 아니라 DB에 둔다(ADR-045)
    lockout: createSupabaseLoginLockout({ client }),
    mcp: {
      connectionTokens: createMemoryConnectionTokenStore(
        config.connection === null ? [] : [config.connection],
      ),
      editorBaseUrl: config.editorBaseUrl,
      formatGuide,
      oauth: { issuer: config.publicBaseUrl, store: createSupabaseOAuthStore({ client }) },
    },
  });
  // 함수 주소를 바로 부르면 요청량 제한(중계)을 건너뛴다 — 중계를 거친 요청만 앱에 넘긴다(보호 대상)
  return async (request) =>
    sameSecret(request.headers.get(RELAY_SECRET_HEADER), config.relaySecret)
      ? app.fetch(withoutFunctionPrefix(request))
      : relayOnly();
}
