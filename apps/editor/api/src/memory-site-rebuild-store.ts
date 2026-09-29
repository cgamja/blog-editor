import { IDLE_SITE_REBUILD } from "./site-rebuild-store";
import type { SiteRebuildState, SiteRebuildStore } from "./site-rebuild-store";

/** 테스트 · 로컬용 재빌드 상태 저장소. 넣고 꺼낼 때 복제해 호출자와 객체를 공유하지 않는다 */
export function createMemorySiteRebuildStore(): SiteRebuildStore {
  let current: SiteRebuildState = { ...IDLE_SITE_REBUILD };
  return {
    async get() {
      return { ...current };
    },
    async put(state) {
      current = { ...state };
    },
  };
}
