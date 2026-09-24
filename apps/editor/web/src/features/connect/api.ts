import { apiRequest } from "../../shared/api/http";
import { SETTINGS_PATH } from "./constants";
import type { WorkspaceSettings } from "./types";

export async function fetchSettings(): Promise<WorkspaceSettings> {
  const response = await apiRequest(SETTINGS_PATH);
  return (await response.json()) as WorkspaceSettings;
}

/** 가이드만 바꾼다 — 카테고리 · 연결 정보는 서버 설정이다. 저장한 뒤의 설정을 돌려준다 */
export async function saveGuide(guide: string): Promise<WorkspaceSettings> {
  const response = await apiRequest(SETTINGS_PATH, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ guide }),
  });
  return (await response.json()) as WorkspaceSettings;
}
