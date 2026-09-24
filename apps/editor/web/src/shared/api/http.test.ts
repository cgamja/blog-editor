import { ApiError, UnauthorizedError } from "./errors";
import { apiRequest } from "./http";

const respond = (response: Response) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(response)),
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiRequest — API 요청 도우미는 401과 그 밖의 실패를 오류로 나눈다", () => {
  it("WHEN 401을 받는다 THEN UnauthorizedError다", async () => {
    respond(new Response(JSON.stringify({ message: "로그인이 필요하다" }), { status: 401 }));

    await expect(apiRequest("/api/posts")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("WHEN 문장이 든 JSON 실패 응답을 받는다 THEN 상태 코드와 그 문장을 가진 ApiError다", async () => {
    respond(
      new Response(JSON.stringify({ message: "다른 곳에서 먼저 저장했다" }), { status: 409 }),
    );

    const error = await apiRequest("/api/posts/a").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, userMessage: "다른 곳에서 먼저 저장했다" });
  });

  it("WHEN JSON이 아닌 실패 응답을 받는다 THEN 문장 없는 ApiError다", async () => {
    respond(new Response("Bad Gateway", { status: 502 }));

    await expect(apiRequest("/api/posts")).rejects.toMatchObject({
      status: 502,
      userMessage: null,
    });
  });

  it("WHEN 2xx를 받는다 THEN 응답을 그대로 돌려준다", async () => {
    respond(new Response(null, { status: 204 }));

    expect((await apiRequest("/api/session", { method: "DELETE" })).status).toBe(204);
  });
});
