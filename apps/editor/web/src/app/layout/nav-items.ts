import { MESSAGES } from "../../shared/messages";
import { ROUTES } from "../../shared/routes/constants";

/** 왼쪽 메뉴(Figma 66:2) — 새 화면은 여기와 router.tsx의 AppShell 자식에 더한다 */
export const NAV_ITEMS = [
  { to: ROUTES.home, label: MESSAGES.nav.posts, end: true },
  { to: ROUTES.connect, label: MESSAGES.nav.connect, end: false },
  { to: ROUTES.settings, label: MESSAGES.nav.settings, end: false },
] as const;
