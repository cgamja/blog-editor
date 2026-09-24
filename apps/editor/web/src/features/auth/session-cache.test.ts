import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { SESSION_QUERY_KEY } from "./constants";
import { markSignedIn } from "./session-cache";
import type { SessionState } from "./types";

// 가드(RequireSession)와 같은 옵션 — 캐시에 값이 있으면 첫 렌더는 그 값을 그대로 읽는다
const guardObserver = (client: QueryClient) =>
  new QueryObserver<SessionState>(client, {
    queryKey: SESSION_QUERY_KEY,
    queryFn: () => Promise.resolve("anonymous"),
    staleTime: Infinity,
  });

describe("markSignedIn — 로그인 성공은 가드가 읽을 세션 캐시를 바로 로그인됨으로 바꾼다", () => {
  it("WHEN 가드가 로그인 화면으로 보낸 뒤(세션 캐시 anonymous) 로그인에 성공한다 THEN 가드의 첫 읽기가 로그인됨이다", () => {
    const client = new QueryClient();
    client.setQueryData<SessionState>(SESSION_QUERY_KEY, "anonymous");

    markSignedIn(client);

    expect(guardObserver(client).getCurrentResult().data).toBe("authenticated");
  });
});
