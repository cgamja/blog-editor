import { SESSION_QUERY_KEY } from "../features/auth";
import { ApiError, UnauthorizedError } from "../shared/api/errors";
import { createQueryClient } from "./query-client";

const reject = (error: Error) => () => Promise.reject(error);

describe("createQueryClient — 어느 요청이든 401이면 세션을 로그인 필요로 바꾼다", () => {
  it("WHEN 쿼리가 UnauthorizedError로 실패한다 THEN 세션이 로그인 필요다", async () => {
    const client = createQueryClient();
    client.setQueryData(SESSION_QUERY_KEY, "authenticated");

    await client
      .fetchQuery({ queryKey: ["posts"], queryFn: reject(new UnauthorizedError()) })
      .catch(() => {});

    expect(client.getQueryData(SESSION_QUERY_KEY)).toBe("anonymous");
  });

  it("WHEN 저장 같은 mutation이 UnauthorizedError로 실패한다 THEN 세션이 로그인 필요다", async () => {
    const client = createQueryClient();
    client.setQueryData(SESSION_QUERY_KEY, "authenticated");

    await client
      .getMutationCache()
      .build(client, { mutationFn: reject(new UnauthorizedError()) })
      .execute(undefined)
      .catch(() => {});

    expect(client.getQueryData(SESSION_QUERY_KEY)).toBe("anonymous");
  });

  it("WHEN meta.expiresSessionOnUnauthorized false인 mutation이 UnauthorizedError로 실패한다 THEN 세션은 로그인됨 그대로다", async () => {
    const client = createQueryClient();
    client.setQueryData(SESSION_QUERY_KEY, "authenticated");

    await client
      .getMutationCache()
      .build(client, {
        mutationFn: reject(new UnauthorizedError()),
        meta: { expiresSessionOnUnauthorized: false },
      })
      .execute(undefined)
      .catch(() => {});

    expect(client.getQueryData(SESSION_QUERY_KEY)).toBe("authenticated");
  });

  it("WHEN 401이 아닌 오류로 실패한다 THEN 세션을 건드리지 않는다", async () => {
    const client = createQueryClient();
    client.setQueryData(SESSION_QUERY_KEY, "authenticated");

    await client
      // 재시도는 아래 테스트가 본다 — 여기서는 세션만 본다
      .fetchQuery({ queryKey: ["posts"], queryFn: reject(new ApiError(409, null)), retry: false })
      .catch(() => {});

    expect(client.getQueryData(SESSION_QUERY_KEY)).toBe("authenticated");
  });

  it("WHEN 재시도 여부를 묻는다 THEN 401은 다시 묻지 않고 다른 오류는 3번까지 다시 묻는다", () => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry;
    if (typeof retry !== "function") throw new Error("retry는 함수여야 한다");

    expect(retry(0, new UnauthorizedError())).toBe(false);
    expect(retry(2, new ApiError(500, null))).toBe(true);
    expect(retry(3, new ApiError(500, null))).toBe(false);
  });
});
