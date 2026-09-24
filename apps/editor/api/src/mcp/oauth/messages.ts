/** OAuth 화면 문장 — 받는 쪽은 사람(블로그 주인)이다. 오류 설명은 RFC 6749 error 코드와 같이 간다. */
export const PAGE_TITLE = "AI 연결 허용";
export const CONSENT_LEAD =
  "아래 주소로 돌아가는 AI 앱이 블로그에 초안을 쓰도록 허용할까요? 발행은 할 수 없습니다.";
export const REDIRECT_LABEL = "허용하면 돌아갈 곳";
/** client_name은 등록한 쪽이 마음대로 적는다 — 제목이 아니라 보조 정보로만 보인다(피싱 완화) */
export const CLIENT_NAME_LABEL = "앱이 밝힌 이름(확인되지 않음)";
/** client_name이 없을 때 */
export const DEFAULT_CLIENT_NAME = "AI 앱";
export const LOOPBACK_WARNING =
  "이 컴퓨터 안의 프로그램(예: Claude Code)으로 돌아갑니다. 직접 시작한 연결이 아니면 거부하세요.";
export const USERNAME_LABEL = "아이디";
export const PASSWORD_LABEL = "비밀번호";
export const ALLOW_LABEL = "허용";
export const DENY_LABEL = "거부";
export const LOGIN_FAILED_PAGE_MESSAGE = "아이디 또는 비밀번호가 맞지 않습니다.";
export const INVALID_CLIENT_PAGE_MESSAGE =
  "연결 요청이 올바르지 않습니다(등록되지 않은 앱이거나 돌아갈 주소가 다릅니다). AI 앱에서 연결을 다시 시작하세요.";
export const FORBIDDEN_ORIGIN_PAGE_MESSAGE =
  "다른 사이트에서 보낸 허용 요청이라 막았습니다. AI 앱에서 연결을 다시 시작하세요.";

export const INVALID_REDIRECT_URI_DESCRIPTION =
  "redirect_uris는 https://claude.ai/api/mcp/auth_callback 또는 http://localhost|127.0.0.1:<포트>/callback만 받는다";
export const INVALID_CLIENT_METADATA_DESCRIPTION =
  "공개 클라이언트(token_endpoint_auth_method: none) · authorization_code/refresh_token · code만 받는다";
export const PKCE_REQUIRED_DESCRIPTION = "code_challenge(S256)가 필요하다";
export const REGISTRATION_FULL_DESCRIPTION =
  "등록 자리가 모두 연결된 앱으로 차 있다 — 서버를 다시 시작하면 비워진다";
export const INVALID_GRANT_DESCRIPTION =
  "코드 · refresh 토큰이 없거나 만료됐거나 요청 값과 맞지 않는다";
