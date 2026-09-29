/** 저장소에 남는 재빌드 상태 — `off`(훅 없음)는 저장하지 않고 앱 설정에서 나온다 */
export type SiteRebuildStatus = "idle" | "pending" | "sent" | "failed";

export interface SiteRebuildState {
  status: SiteRebuildStatus;
  /** 마지막 요청의 id — 30초 묶기에서 "내가 아직 마지막인가"를 판정한다 */
  requestId: string | null;
  /** 상태가 바뀐 시각(ISO 8601 UTC) */
  updatedAt: string | null;
}

/**
 * 재빌드 상태 저장소(openspec site-rebuild · ADR-047) — 워크스페이스마다 한 행. 마지막 쓰기가 이긴다.
 * 배포는 요청마다 인스턴스가 달라 묶음 대기와 상태를 메모리에 둘 수 없어 저장소에 둔다.
 */
export interface SiteRebuildStore {
  get(): Promise<SiteRebuildState>;
  put(state: SiteRebuildState): Promise<void>;
}

export const IDLE_SITE_REBUILD: SiteRebuildState = {
  status: "idle",
  requestId: null,
  updatedAt: null,
};
