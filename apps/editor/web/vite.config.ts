import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const MAX_PORT = 65535;
// 로컬 API(apps/editor/api serve.ts의 기본 포트) — 같은 출처로 넘겨 SameSite=Strict 세션 쿠키가 그대로 간다(adr-006).
// 병렬 worktree에서 API를 다른 포트로 띄우면 `API_PORT`로 맞춘다
const DEFAULT_API_PORT = 8787;
const PROXIED_PATHS = ["/api", "/images", "/public"] as const;

/**
 * 병렬 worktree마다 PORT를 따로 준다(CLAUDE.md 가정). 포트가 잡혀 있으면 옆 포트로 옮기지 않고 멈춘다 —
 * 자동 이동은 증거 캡처가 엉뚱한 포트를 때리게 만든다.
 */
function readPort(name: string, raw: string | undefined): number {
  const port = Number(raw);
  if (
    raw === undefined ||
    raw.trim() === "" ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > MAX_PORT
  ) {
    throw new Error(
      `web: ${name} 환경 변수가 필요하다(1~${MAX_PORT} 정수) — 받은 값: "${raw ?? ""}"`,
    );
  }
  return port;
}

function localApiOrigin(raw: string | undefined): string {
  const port = raw === undefined ? DEFAULT_API_PORT : readPort("API_PORT", raw);
  return `http://127.0.0.1:${port}`;
}

export default defineConfig(({ command }) => ({
  root: fileURLToPath(new URL(".", import.meta.url)),
  // 스티커 원본을 에디터 DOM의 `/stickers/{id}.png`(에디터 출처 기준)로 — editor-react 플레이그라운드와 같다.
  // 배포(M4)에서는 에디터 출처의 CloudFront가 `/stickers/*` · `/images/*`를 자산 버킷으로 경로 라우팅한다
  publicDir: fileURLToPath(new URL("../../../packages/content-render/assets", import.meta.url)),
  plugins: [react()],
  server:
    command === "serve"
      ? {
          host: "127.0.0.1",
          port: readPort("PORT", process.env.PORT),
          strictPort: true,
          proxy: Object.fromEntries(
            PROXIED_PATHS.map((path) => [path, localApiOrigin(process.env.API_PORT)]),
          ),
        }
      : {},
}));
