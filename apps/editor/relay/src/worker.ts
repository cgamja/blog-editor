/**
 * Cloudflare Worker 진입점(ADR-047 · wrangler.jsonc의 main) — API 경로는 함수로 중계하고,
 * 나머지는 정적 자산(화면 파일 · 없는 경로는 index.html)이 받는다.
 */
import { relay } from "./relay";
import type { RelayEnv } from "./types";

interface WorkerEnv extends RelayEnv {
  /** wrangler.jsonc assets.binding — 빌드한 화면 파일 */
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return (await relay(request, env)) ?? env.ASSETS.fetch(request);
  },
};
