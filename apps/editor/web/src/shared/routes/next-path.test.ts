import { loginPathFor, safeNextPath } from "./next-path";

describe("safeNextPath — 로그인 뒤 돌아갈 경로는 이 앱 안의 경로만 받는다", () => {
  it("WHEN 앱 안의 경로를 고른다 THEN 같은 경로다", () => {
    expect(safeNextPath("/posts/hello/edit?tab=info")).toBe("/posts/hello/edit?tab=info");
  });

  it("WHEN 다른 출처로 가는 주소를 고른다 THEN 모두 첫 화면이다", () => {
    for (const raw of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
    ]) {
      expect(safeNextPath(raw)).toBe("/");
    }
  });

  it("WHEN 공백 · 백슬래시로 감싼 다른 출처 주소나 쿼리에서 디코딩한 값을 고른다 THEN 모두 첫 화면이다", () => {
    for (const raw of [
      "\t//evil",
      "/\t/evil",
      "\\\\evil",
      new URLSearchParams("next=%2F%2Fevil").get("next"),
    ]) {
      expect(safeNextPath(raw)).toBe("/");
    }
  });

  it("WHEN 로그인 화면 자신 · 빈 값을 고른다 THEN 모두 첫 화면이다", () => {
    for (const raw of ["/login", "/login?next=/x", "", null]) {
      expect(safeNextPath(raw)).toBe("/");
    }
  });

  it("WHEN 대소문자만 다른 로그인 화면을 고른다 THEN 첫 화면이다", () => {
    for (const raw of ["/LOGIN", "/Login?next=/x", "/login/"]) {
      expect(safeNextPath(raw)).toBe("/");
    }
  });

  it("WHEN 제어 문자가 든 경로를 고른다 THEN 첫 화면이다", () => {
    expect(safeNextPath("/a\nb")).toBe("/");
  });
});

describe("loginPathFor — 로그인이 필요한 화면은 지금 경로를 기억해 로그인 화면으로 보낸다", () => {
  it("WHEN 편집 화면에서 로그인이 풀린다 THEN next에 인코딩한 지금 경로를 붙인다", () => {
    expect(loginPathFor("/posts/hello/edit")).toBe("/login?next=%2Fposts%2Fhello%2Fedit");
  });

  it("WHEN 첫 화면에서 로그인이 풀린다 THEN next 없이 로그인 화면이다", () => {
    expect(loginPathFor("/")).toBe("/login");
  });
});
