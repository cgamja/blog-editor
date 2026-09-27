import { QueryClient } from "@tanstack/react-query";
import { POST_SUMMARIES_QUERY_KEY } from "../features/editor";
import { POSTS_QUERY_KEY } from "../features/posts";

describe("web-app — 기능끼리 쿼리 키가 겹치지 않는다", () => {
  it("WHEN 글 목록과 편집 화면 글 요약을 캐시하고 목록을 무효화하면 THEN 두 캐시는 따로이고 둘 다 무효화된다", async () => {
    const client = new QueryClient();
    const summaries = [{ slug: "a", title: "제목", description: "설명", category: "studio" }];
    client.setQueryData(POSTS_QUERY_KEY, [{ slug: "a" }]);
    client.setQueryData(POST_SUMMARIES_QUERY_KEY, summaries);

    await client.invalidateQueries({ queryKey: POSTS_QUERY_KEY });

    expect(client.getQueryData(POSTS_QUERY_KEY)).toEqual([{ slug: "a" }]);
    expect(client.getQueryData(POST_SUMMARIES_QUERY_KEY)).toEqual(summaries);
    expect(client.getQueryState(POST_SUMMARIES_QUERY_KEY)?.isInvalidated).toBe(true);
  });
});
