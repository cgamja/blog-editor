import { useQuery } from "@tanstack/react-query";
import { probeSession } from "../api/client";
import { SESSION_QUERY_KEY } from "../query-client";

/** 로그인 여부 — 화면 이동마다 새로 묻지 않고, 로그인 · 로그아웃이 이 쿼리를 무효화한다. */
export function useSession() {
  return useQuery({ queryKey: SESSION_QUERY_KEY, queryFn: probeSession, staleTime: Infinity });
}
