import { Schema } from "prosemirror-model";
import { DEFAULT_CALLOUT_TONE } from "./constants";

/**
 * markdown → doc 변환 전용 ProseMirror 스키마(adr-013). content-schema는 ProseMirror를 모르므로
 * (adr-009) 여기서 따로 정의한다. 노드 · 마크 이름을 문서 JSON의 type과 그대로 맞춰(예: "bulletList")
 * `Node.toJSON()` 출력을 후처리 없이 바로 문서 JSON 조각으로 쓸 수 있게 한다.
 *
 * font · motion · width · stickers(꾸미기 attrs)는 이 스키마에 없다 — markdown 토큰에 나타나지 않고
 * (지시어 줄은 파싱 전에 걷어낸다) parser.ts가 stage 1에서 모은 지시어 값을 doc JSON에 직접 얹는다.
 * 이미지도 마크다운 문법상 인라인 노드로 파싱되지만(문단 자식), stage 1이 "글자와 섞이지 않고
 * 최상위에 홀로 있는 이미지"만 통과시키므로 parser.ts가 그 문단을 최상위 image 블록으로 푼다.
 */
export const pmSchema = new Schema({
  nodes: {
    doc: { content: "block+" },

    paragraph: { group: "block", content: "inline*" },
    heading: {
      group: "block",
      content: "inline*",
      attrs: { level: { default: 2 } },
    },
    blockquote: { group: "block", content: "paragraph+" },
    codeBlock: {
      group: "block",
      content: "text*",
      marks: "",
      code: true,
      attrs: { language: { default: undefined } },
    },
    horizontalRule: { group: "block" },
    callout: {
      group: "block",
      content: "(paragraph | bulletList | orderedList)+",
      attrs: { tone: { default: DEFAULT_CALLOUT_TONE } },
    },
    bulletList: { group: "block", content: "listItem+" },
    // start 없음은 toJSON에 undefined로 남고 normalize가 지운다
    orderedList: { group: "block", content: "listItem+", attrs: { start: { default: undefined } } },
    listItem: { content: "paragraph (bulletList | orderedList)*" },
    // 칸은 markdown-it이 inline 토큰을 바로 넣으므로 인라인을 받는다 — parser.ts가 문서 모양(칸 안 문단 하나)으로 감싼다
    table: { group: "block", content: "tableRow+" },
    tableRow: { content: "tableCell+" },
    tableCell: { content: "inline*", attrs: { align: { default: undefined } } },

    image: {
      group: "inline",
      inline: true,
      attrs: { src: { default: "" }, alt: { default: "" } },
    },
    // 강제 줄바꿈(adr-028) — 문단 안에만. 제목 · 표 칸 자리는 check.ts가 막는다
    hardBreak: { group: "inline", inline: true },
    text: { group: "inline" },
  },
  marks: {
    bold: {},
    italic: {},
    code: {},
    link: { attrs: { href: { default: "" } }, inclusive: false },
    strike: {},
    underline: {},
    // 값이 없는 속성은 toJSON에 undefined로 남고 normalize가 지운다(codeBlock.language와 같다)
    textStyle: {
      attrs: {
        font: { default: undefined },
        weight: { default: undefined },
        size: { default: undefined },
        color: { default: undefined },
        highlight: { default: undefined },
      },
    },
  },
});
