import { MIXED } from "@blog-editor/editor-core";
import { TEXT_COLORS } from "@blog-editor/content-schema";
import {
  contrastRatio,
  isHardToRead,
  normalizeHexInput,
  toolbarPlacement,
  weightOptionsFor,
} from "./text-toolbar-model";

describe("editor-text-style: 색 대비가 낮으면 경고한다", () => {
  it("WHEN contrastRatio('#000000', '#ffffff')를 잰다 THEN 21이다", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("WHEN 글자색 프리셋 넷과 { color: '#dddddd' }를 잰다 THEN 프리셋은 읽을 만하고 #dddddd는 읽기 어렵다", () => {
    for (const color of TEXT_COLORS) {
      expect(isHardToRead({ color })).toBe(false);
    }
    expect(isHardToRead({ color: "#dddddd" })).toBe(true);
  });
});

describe("editor-text-style: 직접 입력 색을 정규형으로 받는다", () => {
  it("WHEN ' #AABBCC ', 'aabbcc', '#abc', '#gggggg'를 넣는다 THEN 앞 둘은 '#aabbcc', 뒤 둘은 null이다", () => {
    expect(normalizeHexInput(" #AABBCC ")).toBe("#aabbcc");
    expect(normalizeHexInput("aabbcc")).toBe("#aabbcc");
    expect(normalizeHexInput("#abc")).toBeNull();
    expect(normalizeHexInput("#gggggg")).toBeNull();
  });
});

describe("editor-text-style: 도구줄은 선택 위, 자리가 없으면 아래", () => {
  it("WHEN 선택 위쪽 100, 도구줄 48, 틈 8 THEN top 44이고 위다", () => {
    expect(
      toolbarPlacement({ selectionTop: 100, selectionBottom: 120, toolbarHeight: 48, gap: 8 }),
    ).toEqual({ top: 44, below: false });
  });

  it("WHEN 선택 위쪽 20, 아래쪽 40, 도구줄 48, 틈 8 THEN top 48이고 아래다", () => {
    expect(
      toolbarPlacement({ selectionTop: 20, selectionBottom: 40, toolbarHeight: 48, gap: 8 }),
    ).toEqual({ top: 48, below: true });
  });

  it("WHEN 선택 위쪽 0(첫 줄), 보이는 영역 위쪽 -64(종이 여백), 도구줄 48, 틈 8 THEN top -56이고 위다", () => {
    expect(
      toolbarPlacement({
        selectionTop: 0,
        selectionBottom: 20,
        toolbarHeight: 48,
        gap: 8,
        boundaryTop: -64,
      }),
    ).toEqual({ top: -56, below: false });
  });
});

describe("editor-text-style: 두께 선택지는 글꼴을 따른다", () => {
  it("WHEN 글꼴이 null · gaegu · jua · MIXED일 때 두께 선택지를 구한다 THEN 셋 · light만 · 없음(이유) · 없음(이유)이다", () => {
    expect(weightOptionsFor(null)).toEqual({
      weights: ["light", "medium", "heavy"],
      reason: null,
    });
    expect(weightOptionsFor("gaegu")).toEqual({ weights: ["light"], reason: null });

    const jua = weightOptionsFor("jua");
    expect(jua.weights).toEqual([]);
    expect(jua.reason).not.toBeNull();

    const mixed = weightOptionsFor(MIXED);
    expect(mixed.weights).toEqual([]);
    expect(mixed.reason).not.toBeNull();
  });
});
