import { createBrowserRouter } from "react-router";
import { LoginPage, RequireSession, SessionErrorBoundary } from "../features/auth";
import { editorRoutes } from "../features/editor";
import { ConnectPage } from "../features/connect";
import { MESSAGES } from "../shared/messages";
import { ROUTES } from "../shared/routes/constants";
import { AppShell } from "./layout/AppShell";
import { PostListWithDialogs } from "./list-dialogs";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { RouteErrorPage } from "./pages/RouteErrorPage";

/**
 * 데이터 라우터(https://reactrouter.com/start/data/installation) — 오류 경계를 라우트 한 곳에 둔다.
 * 로그인 화면 밖은 모두 `RequireSession` 아래라, 새 화면은 여기에 자식으로만 더하면 가드를 받는다.
 * 가드 아래 화면이 던진 401은 오류 화면이 아니라 로그인 화면으로 간다(`SessionErrorBoundary`).
 * 메뉴가 있는 화면은 `AppShell`의 자식, 편집처럼 전체 화면을 쓰는 것은 그 옆에 둔다.
 * 목록의 가져오기 · AI로 쓰기 대화상자는 `PostListWithDialogs`가 `PostListPage`의 `dialogs`로 꽂는다(#98).
 */
export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      { path: ROUTES.login, element: <LoginPage /> },
      {
        element: <RequireSession />,
        errorElement: <SessionErrorBoundary />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: ROUTES.home, element: <PostListWithDialogs /> },
              { path: ROUTES.connect, element: <ConnectPage /> },
              {
                path: ROUTES.settings,
                element: <PlaceholderPage title={MESSAGES.pages.settings} />,
              },
            ],
          },
          // 편집 화면 — 메뉴 없는 전체 화면이라 AppShell 밖이다
          ...editorRoutes,
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
