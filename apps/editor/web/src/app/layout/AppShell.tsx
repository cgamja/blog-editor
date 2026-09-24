import { NavLink, Outlet } from "react-router";
import { useLogout } from "../../features/auth";
import { MESSAGES } from "../../shared/messages";
import { NAV_ITEMS } from "./nav-items";

/**
 * 로그인한 화면의 틀(Figma 66:2) — 왼쪽 메뉴 + 본문 자리. 편집 화면은 메뉴 없는 전체 화면이라 이 틀 밖이다.
 * `NavLink`가 지금 화면 항목에 `aria-current="page"`를 붙인다.
 */
export function AppShell() {
  const logout = useLogout();

  const handleLogout = () => logout.mutate();

  return (
    <div className="app-shell">
      <nav className="app-nav" aria-label={MESSAGES.nav.label}>
        <div className="app-nav__brand">
          <span className="brand-logo">{MESSAGES.brand}</span>
          <span className="brand-sub">{MESSAGES.appTitle}</span>
        </div>
        <div className="app-nav__items">
          {NAV_ITEMS.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className="app-nav__item">
              {label}
            </NavLink>
          ))}
        </div>
        <button
          type="button"
          className="app-nav__logout"
          onClick={handleLogout}
          disabled={logout.isPending}
        >
          {logout.isPending ? MESSAGES.nav.loggingOut : MESSAGES.nav.logout}
        </button>
      </nav>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
