import type { SettingsStore } from "./settings-store";

/** 로컬 개발용 설정 저장소 — `<root>/workspaces/<workspaceId>/settings.json`. */
export function createFileSettingsStore(options: {
  root: string;
  workspaceId: string;
}): SettingsStore {
  throw new Error(`미구현: ${options.root}`);
}
