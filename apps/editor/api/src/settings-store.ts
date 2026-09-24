/** 워크스페이스 설정 중 화면에서 고칠 수 있는 것 — 카테고리는 앱 설정(AppOptions)이 원천이라 여기 없다. */
export interface WorkspaceSettings {
  /** AI가 초안을 쓰기 전에 읽는 글쓰기 가이드(MCP `get_writing_guide`) */
  guide: string;
}

/**
 * 설정 저장소(adr-007 — 워크스페이스마다 하나). 1단계는 사용자 한 명이라 revision 없이 마지막 쓰기가 이긴다
 * (design.md 1 — 글과 달리 두 탭 동시 편집의 손실이 작다).
 */
export interface SettingsStore {
  get(): Promise<WorkspaceSettings>;
  put(settings: WorkspaceSettings): Promise<void>;
}

export const EMPTY_SETTINGS: WorkspaceSettings = { guide: "" };

/** 설정 응답의 연결 정보 — 저장하지 않고 앱 설정(`/mcp` · OAuth)에서 나온다 */
export interface ConnectorInfo {
  /** `/mcp`가 열렸는가 */
  enabled: boolean;
  /** claude.ai가 닿는 커넥터 주소 — OAuth 발급자가 있을 때만(연결용 토큰만 있는 로컬 `/mcp`는 null) */
  url: string | null;
}
