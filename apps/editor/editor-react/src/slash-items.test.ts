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
});
