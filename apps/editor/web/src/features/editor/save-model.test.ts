import { ApiError, ConflictError, UnauthorizedError } from "../../shared/api/errors";
import { renameErrorKindOf, saveErrorKindOf, saveHeadersOf, saveStatusText } from "./save-model";

describe("web-post-save — 저장 조건 헤더", () => {
  it('WHEN revision null과 abc로 헤더를 만들면 THEN If-None-Match: * · If-Match: "abc"다', () => {
    expect(saveHeadersOf(null)).toEqual({ "If-None-Match": "*" });
    expect(saveHeadersOf("abc")).toEqual({ "If-Match": '"abc"' });
  });
});

describe("web-post-save — 저장 실패 나누기", () => {
  it("WHEN UnauthorizedError를 나누면 THEN 세션 만료다", () => {
    expect(saveErrorKindOf(new UnauthorizedError(), false)).toBe("expired");
  });

  it("WHEN 409를 새 글 · 불러온 글로 나누면 THEN 주소 겹침 · 충돌이다", () => {
    const conflict = new ConflictError("다른 곳에서 수정됐다");

    expect(saveErrorKindOf(conflict, true)).toBe("slugTaken");
    expect(saveErrorKindOf(conflict, false)).toBe("conflict");
  });

  it("WHEN 502와 네트워크 TypeError를 나누면 THEN 둘 다 실패다", () => {
    expect(saveErrorKindOf(new ApiError(502, null), false)).toBe("failed");
    expect(saveErrorKindOf(new TypeError("Failed to fetch"), false)).toBe("failed");
  });
});

describe("web-post-save — 주소 바꾸기 409 나누기", () => {
  it("WHEN 409를 이유 stale · published · taken으로 나누면 THEN 충돌 · 주소 칸 · 주소 칸이다", () => {
    const conflictOf = (reason: string) => new ConflictError("거절", { message: "거절", reason });

    expect(renameErrorKindOf(conflictOf("stale"))).toBe("conflict");
    expect(renameErrorKindOf(conflictOf("published"))).toBe("slugRejected");
    expect(renameErrorKindOf(conflictOf("taken"))).toBe("slugRejected");
  });
});

describe("web-post-save — 머리줄 저장 문구", () => {
  it("WHEN 15:42 · 00:05에 저장된 문구를 만들면 THEN 오후 3시 42분 · 오전 12시 5분이다", () => {
    const at = (hours: number, minutes: number) => new Date(2026, 8, 24, hours, minutes);

    expect(saveStatusText({ kind: "saved", at: at(15, 42), isPublished: false })).toBe(
      "초안 저장됨, 오후 3시 42분",
    );
    expect(saveStatusText({ kind: "saved", at: at(0, 5), isPublished: false })).toBe(
      "초안 저장됨, 오전 12시 5분",
    );
  });
});
