import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { SESSION_QUERY_KEY } from "./constants";
import { markSignedIn, markSignedOut } from "./session-cache";
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

describe("markSignedOut — 로그아웃은 캐시를 비우고 세션을 로그인 필요로 둔다", () => {
  it("WHEN 세션이 로그인됨이고 글 목록 쿼리가 캐시에 있을 때 로그아웃 캐시 처리를 한다 THEN 글 목록 쿼리는 없고 세션은 로그인 필요다", () => {
    const client = new QueryClient();
    const postsKey = ["posts"];
    client.setQueryData<SessionState>(SESSION_QUERY_KEY, "authenticated");
    client.setQueryData(postsKey, { posts: [] });

    markSignedOut(client);

    expect(client.getQueryData(postsKey)).toBeUndefined();
    expect(guardObserver(client).getCurrentResult().data).toBe("anonymous");
  });
});
