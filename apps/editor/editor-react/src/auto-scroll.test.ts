import { autoScrollStep } from "./auto-scroll";

const box = { top: 100, bottom: 700 };

describe("editor-block-drag: 끄기와 블록 메뉴 — 가장자리 자동 스크롤", () => {
  it("WHEN 포인터가 스크롤 상자 가운데 · 위 가장자리 · 아래 가장자리 · 위 가장자리에서 24px 안쪽 · 상자 밖 위에 있다 THEN 0 · -16 · 16 · -8 · -16이다", () => {
    expect(autoScrollStep(400, box)).toBe(0);
    expect(autoScrollStep(100, box)).toBe(-16);
    expect(autoScrollStep(700, box)).toBe(16);
    expect(autoScrollStep(124, box)).toBe(-8);
    expect(autoScrollStep(20, box)).toBe(-16);
  });
});
