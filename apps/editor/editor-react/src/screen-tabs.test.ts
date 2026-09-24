import { tabIndexAfterKey } from "./screen-tabs";

describe("editor-screen: 옆 패널 탭 키보드 이동", () => {
  it("WHEN 탭 2개 중 0번 · 1번에서 ArrowRight THEN 각각 1번 · 0번(끝에서 처음으로)", () => {
    expect(tabIndexAfterKey(0, "ArrowRight", 2)).toBe(1);
    expect(tabIndexAfterKey(1, "ArrowRight", 2)).toBe(0);
  });

  it("WHEN 탭 2개 중 1번 · 0번에서 ArrowLeft THEN 각각 0번 · 1번(처음에서 마지막으로)", () => {
    expect(tabIndexAfterKey(1, "ArrowLeft", 2)).toBe(0);
    expect(tabIndexAfterKey(0, "ArrowLeft", 2)).toBe(1);
  });

  it("WHEN 탭 3개 중 1번에서 Home · End THEN 각각 0번 · 2번", () => {
    expect(tabIndexAfterKey(1, "Home", 3)).toBe(0);
    expect(tabIndexAfterKey(1, "End", 3)).toBe(2);
  });

  it("WHEN Enter · Tab THEN null(탭을 바꾸지 않는다)", () => {
    expect(tabIndexAfterKey(0, "Enter", 2)).toBeNull();
    expect(tabIndexAfterKey(0, "Tab", 2)).toBeNull();
  });
});
