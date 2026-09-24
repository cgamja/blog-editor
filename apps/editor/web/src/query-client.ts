import { QueryClient } from "@tanstack/react-query";
import { UnauthorizedError } from "./api/client";

// TanStack Query 기본 재시도는 3번 — 401은 다시 물어도 같아서 뺀다
const MAX_RETRIES = 3;

export const SESSION_QUERY_KEY = ["session"] as const;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) =>
          !(error instanceof UnauthorizedError) && failureCount < MAX_RETRIES,
      },
    },
  });
}
