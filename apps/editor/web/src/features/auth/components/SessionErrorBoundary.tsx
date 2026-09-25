import { Navigate, useLocation, useRouteError } from "react-router";
import { UnauthorizedError } from "../../../shared/api/errors";
import { loginPathFor } from "../../../shared/routes/next-path";

/**
 * 가드 라우트의 오류 경계(React Router `errorElement`) — 화면이 첫 불러오기 실패를 던졌는데 그것이 401이면
 * 오류 화면 대신 가드처럼 지금 경로를 기억해 로그인 화면으로 보낸다(#119).
 * QueryCache `onError`(세션을 로그인 필요로)는 쿼리 오류와 같은 동기 구간에서 끝나지만, 두 변경(쿼리 오류 ·
 * 세션 캐시)은 각자 `notifyManager.batch`로 따로 `setTimeout(0)`에 알려진다(@tanstack/query-core 5.103
 * `Query.fetch` · `notifyManager` flush). 화면 쿼리(글 목록 · 편집 화면) 관찰자가 먼저 알림을 받아 화면이
 * 다시 그려지며 401을 던지고, 가드는 그다음 알림에서야 로그인 필요를 읽는데 그때는 이미 경계에 가려져 있다.
 * 401이 아닌 오류는 다시 던져 위 경계(RouteErrorPage)로 보낸다.
 */
export function SessionErrorBoundary() {
  const error = useRouteError();
  const location = useLocation();

  if (!(error instanceof UnauthorizedError)) throw error;
  return <Navigate to={loginPathFor(`${location.pathname}${location.search}`)} replace />;
}
