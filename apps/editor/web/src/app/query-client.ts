import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { markSessionExpired } from "../features/auth";
import { UnauthorizedError } from "../shared/api/errors";
import { SESSION_EXPIRY_META } from "../shared/api/constants";

// TanStack Query 기본 재시도는 3번 — 401은 다시 물어도 같아서 뺀다
const MAX_RETRIES = 3;

/**
 * 어느 쿼리 · mutation이든 401(`UnauthorizedError`)이면 세션을 로그인 필요로 바꾼다(design.md 3) —
 * 화면마다 401을 다루지 않아도 가드가 지금 경로를 기억해 로그인 화면으로 보낸다.
 * 편집 화면 저장처럼 스스로 띠로 알리는 mutation은 `meta[SESSION_EXPIRY_META]: false`로 빠진다 —
 * 곧장 로그인 화면으로 가면 쓰던 글을 두고 떠난다(edit-screen design 3).
 * 전역 콜백(https://tanstack.com/query/v5/docs/reference/QueryCache#global-callbacks).
 */
export function createQueryClient(): QueryClient {
  const expireOnUnauthorized = (error: Error) => {
    if (error instanceof UnauthorizedError) markSessionExpired(client);
  };
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: expireOnUnauthorized }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _onMutateResult, mutation) => {
        if (mutation.meta?.[SESSION_EXPIRY_META] === false) return;
        expireOnUnauthorized(error);
      },
    }),
    defaultOptions: {
      queries: {
        retry: (failureCount, error) =>
          !(error instanceof UnauthorizedError) && failureCount < MAX_RETRIES,
      },
    },
  });
  return client;
}
