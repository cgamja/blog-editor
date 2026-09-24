import type { ConnectorInfo, ConnectorState } from "./types";

/** 설정의 연결 정보로 AI 연결 화면이 보일 상태를 고른다 */
export function connectorStateOf(connector: ConnectorInfo): ConnectorState {
  if (!connector.enabled) return "off";
  return connector.url === null ? "no-public-url" : "ready";
}
