import { useQuery } from "@tanstack/react-query";
import { probeSession } from "../api";
import { SESSION_QUERY_KEY } from "../constants";

/** 로그인 여부 — 화면 이동마다 새로 묻지 않는다. 로그인 성공과 401이 이 캐시를 직접 바꾼다(session-cache). */
export function useSession() {
  return useQuery({ queryKey: SESSION_QUERY_KEY, queryFn: probeSession, staleTime: Infinity });
}
