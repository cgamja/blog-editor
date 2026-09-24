import { isRouteErrorResponse, useRouteError } from "react-router";
import { MESSAGES } from "../../shared/messages";
import { NotFoundPage } from "./NotFoundPage";

/**
 * 라우트 오류 경계(React Router `errorElement`, https://reactrouter.com/start/data/routing#error-boundaries).
 * 없는 경로는 404 화면, 그 밖의 오류는 다시 시도 — 새로 불러오면 QueryClient도 새로 만들어진다.
 */
export function RouteErrorPage() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;

  const handleRetry = () => window.location.reload();

  return (
    <main className="app-page">
      <h1 className="page-title">{MESSAGES.error.title}</h1>
      <button type="button" className="app-button" onClick={handleRetry}>
        {MESSAGES.error.retry}
      </button>
    </main>
  );
}
