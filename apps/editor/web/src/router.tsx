import { createBrowserRouter } from "react-router";
import { RequireSession } from "./auth/RequireSession";
import { MESSAGES } from "./messages";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { RouteErrorPage } from "./pages/RouteErrorPage";
import { ROUTES } from "./routes";

/**
 * 데이터 라우터(https://reactrouter.com/start/data/installation) — 오류 경계를 라우트 한 곳에 둔다.
 * 로그인 화면 밖은 모두 `RequireSession` 아래라, 새 화면은 여기에 자식으로만 더하면 가드를 받는다.
 */
export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      { path: ROUTES.login, element: <LoginPage /> },
      {
        element: <RequireSession />,
        children: [
          { path: ROUTES.home, element: <PlaceholderPage title={MESSAGES.pages.posts} /> },
          { path: ROUTES.newPost, element: <PlaceholderPage title={MESSAGES.pages.newPost} /> },
          { path: ROUTES.editPost, element: <PlaceholderPage title={MESSAGES.pages.editPost} /> },
          { path: ROUTES.connect, element: <PlaceholderPage title={MESSAGES.pages.connect} /> },
          { path: ROUTES.settings, element: <PlaceholderPage title={MESSAGES.pages.settings} /> },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
