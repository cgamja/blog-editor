import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
// 확장자를 적는다 — Vite가 다음 메이저에서 기본으로 삼을 native 설정 로더는 확장자 없는 import를 풀지 못해 빌드마다 경고한다
import { WEB_FONTS_STYLESHEET } from "./src/shared/web-fonts.ts";

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

/**
 * index.html `<head>` 끝에 화면 글꼴 스타일시트를 넣는다 — 주소 원천은 미리보기 iframe과 같은 `WEB_FONTS_STYLESHEET`
 * 하나(#112). 빌드에서는 모듈 스크립트 뒤에 놓이지만, 모듈 스크립트는 지연 실행이라 head의 스타일시트가 받아진 뒤에 돈다
 * (HTML "the end" 단계가 script-blocking style sheet를 기다린다) — 앱이 돌 때 글꼴 face가 이미 등록돼 있다는 #107 전제는 그대로.
 * https://vite.dev/guide/api-plugin#transformindexhtml
 */
function webFontsStylesheet(): Plugin {
  return {
    name: "web-fonts-stylesheet",
    transformIndexHtml: () => [
      { tag: "link", attrs: { rel: "stylesheet", href: WEB_FONTS_STYLESHEET }, injectTo: "head" },
    ],
  };
}

export default defineConfig(({ command }) => ({
  root: fileURLToPath(new URL(".", import.meta.url)),
  // 스티커 원본을 에디터 DOM의 `/stickers/{id}.png`(에디터 출처 기준)로 — editor-react 플레이그라운드와 같다.
  // 배포(M4)에서는 에디터 출처의 CloudFront가 `/stickers/*` · `/images/*`를 자산 버킷으로 경로 라우팅한다
  publicDir: fileURLToPath(new URL("../../../packages/content-render/assets", import.meta.url)),
  plugins: [react(), webFontsStylesheet()],
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
