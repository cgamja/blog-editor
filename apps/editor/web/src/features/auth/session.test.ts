import { sessionStateOf } from "./session";

describe("sessionStateOf — 세션 확인 응답의 상태 코드로 로그인 여부를 판정한다", () => {
  it("WHEN 200 · 204를 판정한다 THEN 로그인됨이다", () => {
    expect(sessionStateOf(200)).toBe("authenticated");
    expect(sessionStateOf(204)).toBe("authenticated");
  });

  it("WHEN 401을 판정한다 THEN 로그인 필요다", () => {
    expect(sessionStateOf(401)).toBe("anonymous");
  });

  it("WHEN 403 · 404 · 500을 판정한다 THEN 오류다", () => {
    expect(sessionStateOf(403)).toBe("error");
    expect(sessionStateOf(404)).toBe("error");
    expect(sessionStateOf(500)).toBe("error");
  });
});
