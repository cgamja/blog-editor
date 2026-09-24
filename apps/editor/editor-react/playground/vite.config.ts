import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const MAX_PORT = 65535;

/**
 * 병렬 worktree마다 PORT를 따로 준다(CLAUDE.md 가정). 포트가 잡혀 있으면 옆 포트로 옮기지 않고 멈춘다 —
 * 자동 이동은 증거 캡처가 엉뚱한 포트를 때리게 만든다.
 */
function readPort(raw: string | undefined): number {
  const port = Number(raw);
  if (
    raw === undefined ||
    raw.trim() === "" ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > MAX_PORT
  ) {
    throw new Error(
      `playground: PORT 환경 변수가 필요하다(1~${MAX_PORT} 정수) — 받은 값: "${raw ?? ""}"`,
    );
  }
  return port;
}

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: readPort(process.env.PORT),
    strictPort: true,
  },
});
