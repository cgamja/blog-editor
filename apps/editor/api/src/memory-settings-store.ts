import { EMPTY_SETTINGS } from "./settings-store";
import type { SettingsStore, WorkspaceSettings } from "./settings-store";

/** 테스트 · 기본값용 설정 저장소. 넣고 꺼낼 때 복제해 호출자와 객체를 공유하지 않는다. */
export function createMemorySettingsStore(): SettingsStore {
  let current: WorkspaceSettings = { ...EMPTY_SETTINGS };
  return {
    async get() {
      return { ...current };
    },
    async put(settings) {
      current = { ...settings };
    },
  };
}
