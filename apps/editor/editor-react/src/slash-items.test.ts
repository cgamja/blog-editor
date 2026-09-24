import { INSERTABLE_BLOCKS } from "@blog-editor/editor-core";
import { filterSlashItems } from "./slash-items";

describe("editor-slash-menu: 목록 거르기", () => {
  it("WHEN 한글 이름 · 영문 별칭 · 빈 글자 · 없는 말로 거른다 THEN 큰·작은 제목, 큰 제목, 구분선, 전체, 빈 목록", () => {
    expect(filterSlashItems("제목")).toEqual(["heading2", "heading3"]);
    expect(filterSlashItems("h2")).toEqual(["heading2"]);
    expect(filterSlashItems("HR")).toEqual(["horizontalRule"]);
    expect(filterSlashItems("")).toEqual(Object.keys(INSERTABLE_BLOCKS));
    expect(filterSlashItems("없는말")).toEqual([]);
  });

  it("WHEN 이름을 띄어 쓰지 않고 '큰제목' · '점목록' · '콜아웃메모'로 거른다 THEN 각각 그 항목이 맞는다", () => {
    expect(filterSlashItems("큰제목")).toEqual(["heading2"]);
    expect(filterSlashItems("점목록")).toEqual(["bulletList"]);
    expect(filterSlashItems("콜아웃메모")).toEqual(["calloutNote"]);
  });

  it("WHEN 조합 중인 한글 'ㅈ' · '젬' · '으'로 거른다 THEN 제목 둘을 포함하고, '으'는 콜아웃 · 주의를 포함한다", () => {
    expect(filterSlashItems("ㅈ")).toEqual(expect.arrayContaining(["heading2", "heading3"]));
    expect(filterSlashItems("젬")).toEqual(["heading2", "heading3"]);
    expect(filterSlashItems("으")).toEqual(expect.arrayContaining(["calloutWarning"]));
  });

  it("WHEN 이미지 동작이 있을 때 '이미지' · 'image' · '사진'으로 거른다 THEN 이미지 동작이 맞고, 동작이 없으면 빠진다", () => {
    expect(filterSlashItems("이미지", ["image"])).toEqual(["image"]);
    expect(filterSlashItems("image", ["image"])).toEqual(["image"]);
    expect(filterSlashItems("사진", ["image"])).toEqual(["image"]);
    expect(filterSlashItems("", ["image"]).at(-1)).toBe("image");
    expect(filterSlashItems("이미지")).toEqual([]);
  });
});
