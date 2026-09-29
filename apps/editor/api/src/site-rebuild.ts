import {
  SITE_BUILD_HOOK_TIMEOUT_MS,
  SITE_REBUILD_DEBOUNCE_MS,
  SITE_REBUILD_STALE_MS,
} from "./site-rebuild-constants";
import type { SiteRebuildState } from "./site-rebuild-store";
import type { SiteRebuild, SiteRebuildOptions } from "./site-rebuild-types";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 결과를 쓸 인스턴스가 대기 중에 내려가 남은 pending — 읽을 때만 failed로 본다(쓰지 않는다) */
function isStalePending(state: SiteRebuildState, now: number): boolean {
  if (state.status !== "pending" || state.updatedAt === null) return false;
  return now - Date.parse(state.updatedAt) > SITE_REBUILD_STALE_MS;
}

export function createSiteRebuild(options: SiteRebuildOptions): SiteRebuild {
  const { hookUrl, store, runLater } = options;
  const fetchHook = options.fetch ?? globalThis.fetch;
  const newRequestId = options.newRequestId ?? (() => crypto.randomUUID());
  const stateOf = (status: SiteRebuildState["status"], requestId: string): SiteRebuildState => ({
    status,
    requestId,
    updatedAt: new Date().toISOString(),
  });
  const isLatest = async (requestId: string) => (await store.get()).requestId === requestId;

  /** 훅 한 번 — 2xx면 sent, 그 밖의 상태 · 네트워크 오류 · 시간 초과(중단)는 failed. 던지지 않는다 */
  async function callHook(requestId: string): Promise<SiteRebuildState> {
    let ok: boolean;
    try {
      const res = await fetchHook(hookUrl, {
        method: "POST",
        signal: AbortSignal.timeout(SITE_BUILD_HOOK_TIMEOUT_MS),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }
    return stateOf(ok ? "sent" : "failed", requestId);
  }

  async function sendIfLatest(requestId: string): Promise<void> {
    try {
      await wait(SITE_REBUILD_DEBOUNCE_MS);
      // 기다리는 사이 새 요청이 왔으면 그쪽이 보낸다
      if (!(await isLatest(requestId))) return;
      const result = await callHook(requestId);
      // 훅을 기다리는 사이 다시 시도 · 새 요청이 상태를 바꿨으면 덮지 않는다
      if (!(await isLatest(requestId))) return;
      await store.put(result);
    } catch {
      // 저장소 오류 — 응답 뒤라 알릴 곳이 없다. 상태는 pending으로 남고 읽을 때 1분 뒤 failed로 보인다
    }
  }

  return {
    async request() {
      const requestId = newRequestId();
      await store.put(stateOf("pending", requestId));
      runLater(sendIfLatest(requestId));
    },
    async retry() {
      const requestId = newRequestId();
      await store.put(stateOf("pending", requestId));
      const result = await callHook(requestId);
      // 훅을 기다리는 사이 새 요청이 왔으면 그쪽 pending을 덮지 않고, 화면이 그 pending을 이어 읽게 지금 상태를 준다
      if (!(await isLatest(requestId))) return store.get();
      await store.put(result);
      return result;
    },
    async status() {
      const state = await store.get();
      return isStalePending(state, Date.now()) ? { ...state, status: "failed" } : state;
    },
  };
}
