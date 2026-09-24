import { useId } from "react";
import { useLogout } from "../hooks/use-logout";
import { AUTH_MESSAGES } from "../messages";

/**
 * 메뉴의 로그아웃. 요청이 실패하면 같은 자리에서 "로그아웃하지 못했어요"를 알리고(role=alert) 버튼이
 * 다시 시도가 된다 — 세션은 그대로라 화면을 옮기지 않는다(use-logout).
 */
export function LogoutButton() {
  const logout = useLogout();
  const errorId = useId();
  const { submit, submitting, failed, retry } = AUTH_MESSAGES.logout;

  const handleLogout = () => logout.mutate();

  let label: string = submit;
  if (logout.isPending) label = submitting;
  else if (logout.isError) label = retry;

  return (
    <div className="logout">
      {logout.isError ? (
        <p id={errorId} className="logout__error" role="alert">
          {failed}
        </p>
      ) : null}
      <button
        type="button"
        className="logout__button"
        onClick={handleLogout}
        disabled={logout.isPending}
        aria-describedby={logout.isError ? errorId : undefined}
      >
        {label}
      </button>
    </div>
  );
}
