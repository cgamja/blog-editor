import { useQueryClient } from "@tanstack/react-query";
import { isRouteErrorResponse, useRouteError } from "react-router";
import { MESSAGES } from "../messages";
import { NotFoundPage } from "./NotFoundPage";

/**
 * 라우트 오류 경계(React Router `errorElement`, https://reactrouter.com/start/data/routing#error-boundaries).
 * 없는 경로는 404 화면, 그 밖의 오류는 다시 시도 — 쿼리를 비우고 새로 읽는다.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const queryClient = useQueryClient();

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;

  const retry = () => {
    queryClient.clear();
    window.location.reload();
  };

  return (
    <main className="app-page">
      <h1>{MESSAGES.error.title}</h1>
      <button type="button" onClick={retry}>
        {MESSAGES.error.retry}
      </button>
    </main>
  );
}
