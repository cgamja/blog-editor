import { Navigate, Outlet, useLocation } from "react-router";
import { MESSAGES } from "../../../shared/messages";
import { loginPathFor } from "../../../shared/routes/next-path";
import { useSession } from "../hooks/use-session";
import { AUTH_MESSAGES } from "../messages";

/**
 * 로그인이 필요한 화면을 감싸는 레이아웃(design.md 3). 인증을 loader에 섞지 않아 화면 이슈들이 loader를 자유롭게 쓴다.
 * 판정할 수 없는 응답(403 · 5xx)은 로그인 화면으로 보내지 않고 오류 경계로 던진다.
 */
export function RequireSession() {
  const location = useLocation();
  const session = useSession();

  if (session.isPending) {
    return (
      <p className="app-status" role="status">
        {AUTH_MESSAGES.session.checking}
      </p>
    );
  }
  if (session.isError) throw session.error;
  if (session.data === "error") throw new Error(MESSAGES.error.title);
  if (session.data === "anonymous") {
    return <Navigate to={loginPathFor(`${location.pathname}${location.search}`)} replace />;
  }
  return <Outlet />;
}
