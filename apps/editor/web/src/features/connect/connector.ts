import type { ConnectorInfo, ConnectorState } from "./types";

/** 설정의 연결 정보로 AI 연결 화면이 보일 상태를 고른다 */
export function connectorStateOf(connector: ConnectorInfo): ConnectorState {
  throw new Error(`미구현: ${String(connector.enabled)}`);
}
