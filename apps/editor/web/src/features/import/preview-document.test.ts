import { WEB_FONTS_LINK } from "../../shared/web-fonts";
import { previewDocument } from "./preview-document";

const headOf = (html: string) => html.slice(0, html.indexOf("</head>"));

describe("previewDocument — 가져오기 미리보기 iframe 문서(#112)", () => {
  it("WHEN 미리보기 문서를 만든다 THEN head가 화면 글꼴 스타일시트를 싣는다", () => {
    expect(headOf(previewDocument("<p>본문</p>"))).toContain(WEB_FONTS_LINK);
  });
});
