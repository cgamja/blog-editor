import { imageFilesOf, shouldTakePastedFiles } from "../index";

const file = (type: string) => ({ type, size: 1 });

describe("editor-image-insert: 이미지 파일만 가로챈다", () => {
  it("WHEN image/png · image/svg+xml · text/plain · image/heic를 거른다 THEN image/png · image/heic만 남는다", () => {
    const files = [
      file("image/png"),
      file("image/svg+xml"),
      file("text/plain"),
      file("image/heic"),
    ];

    expect(imageFilesOf(files).map((item) => item.type)).toEqual(["image/png", "image/heic"]);
  });

  it("WHEN 스크린샷(글 없음) · 웹 이미지 복사(meta + img 하나) THEN 파일을 가로챈다", () => {
    expect(shouldTakePastedFiles({ html: "", text: "" })).toBe(true);
    expect(
      shouldTakePastedFiles({
        html: '<meta charset="utf-8"><img src="https://example.com/a.png" alt="고양이">',
        text: "",
      }),
    ).toBe(true);
  });

  it("WHEN Excel · Word처럼 글 · 표 HTML에 스냅샷 이미지가 함께 온다 THEN 가로채지 않고 글 붙여넣기로 둔다", () => {
    expect(
      shouldTakePastedFiles({
        html: "<html><body><table><tr><td>1</td><td>2</td></tr></table></body></html>",
        text: "1\t2",
      }),
    ).toBe(false);
    expect(shouldTakePastedFiles({ html: "<p>안녕</p>", text: "" })).toBe(false);
    expect(shouldTakePastedFiles({ html: "", text: "안녕" })).toBe(false);
  });
});
