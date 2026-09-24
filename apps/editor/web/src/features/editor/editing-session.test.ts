import { adoptSlug, nextEditingSession } from "./editing-session";

describe("web-post-meta — 편집 세션 이어 가기", () => {
  it("WHEN 세션 new가 hello를 adopt한 뒤 경로가 hello가 되면 THEN 세션 키는 new 그대로다", () => {
    const adopted = adoptSlug({ routeKey: "new", sessionKey: "new", adopted: null }, "hello");

    expect(nextEditingSession(adopted, "hello").sessionKey).toBe("new");
  });

  it("WHEN 세션 hello에서 adopt 없이 경로가 other가 되면 THEN 세션 키는 other다", () => {
    const state = { routeKey: "hello", sessionKey: "hello", adopted: null };

    expect(nextEditingSession(state, "other").sessionKey).toBe("other");
  });
});
