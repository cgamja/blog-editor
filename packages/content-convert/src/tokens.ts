import MarkdownIt, { type PluginWithParams } from "markdown-it";
import container from "markdown-it-container";
import type Token from "markdown-it/lib/token.mjs";
import { CALLOUT_CONTAINER_NAME } from "./constants";
import { bracketSpanRule, type SpanOpenMeta } from "./span";

/** 괄호 span 규칙 이름 — 링크 규칙보다 먼저 본다(`[글자]{…}`는 링크가 아니다). */
const BRACKET_SPAN_RULE = "bracket_span";

/** markdown-it-container에 넘기는 옵션 타입 — container 자체의 3번째 매개변수에서 뽑는다. */
type ContainerOpts = NonNullable<Parameters<typeof container>[2]>;

/**
 * `:::` 컨테이너 마커는 이름을 가리지 않고 전부 받아들인다 — `callout`이 아닌 이름(`:::note` 등)도
 * 토큰으로 나오게 해서 check.ts가 "콜아웃은 :::callout만 쓴다"로 거부할 수 있게 한다. 기본
 * validate는 marker 뒤 전체를 이름과 비교해 안 맞으면 그냥 문단 글자로 흘려보내 오류가 조용히
 * 사라진다(adr-013) — 그래서 여기서는 항상 통과시키고 이름 검사는 stage 1(check.ts)로 미룬다.
 */
function validateCalloutMarker(): boolean {
  return true;
}

/**
 * stage 1(토큰 검사) · stage 2(prosemirror-markdown 파싱) 둘 다 이 설정을 쓴다 — 같은 문법을
 * 두 번 알게 되는 트레이드오프를 파서 설정만이라도 하나로 줄인다(adr-013).
 *
 * - "default" 프리셋 + html:true — 표 · 취소선 · HTML이 "그냥 글자"로 사라지지 않고 토큰으로
 *   나와야 거부할 수 있다("commonmark" 프리셋은 이 토큰들을 아예 안 만든다).
 * - linkify · typographer는 끈다 — 자동 링크 감지 · 따옴표 치환은 형식 정의에 없다.
 * - validateLink를 항상 true로 바꾼다 — 기본값은 `javascript:` 링크를 필터링해 그냥 글자로
 *   남기므로, hrefSchema로 직접 거부하려면 링크 토큰 자체가 먼저 나와야 한다.
 */
export function createMarkdownIt(): MarkdownIt {
  const md = new MarkdownIt("default", { html: true, linkify: false, typographer: false });
  md.validateLink = () => true;
  const containerOptions: ContainerOpts = { validate: validateCalloutMarker };
  // markdown-it-container의 타입 선언은 markdown-it을 require()로 다시 import해 우리가 쓰는
  // markdown-it의 ESM 타입과 이름은 같지만 다른 타입으로 취급된다(dual package hazard,
  // node_modules/prosemirror-markdown/src/from_markdown.ts도 같은 이유로 markdown-it import
  // 위에 @ts-ignore를 둔다). md.use()의 매개변수 타입 자체가 `...params: any[]`라 옵션 타입은
  // 어차피 여기서 못 걸러 containerOptions 변수 선언에서 미리 걸러 둔다.
  md.use(container as unknown as PluginWithParams, CALLOUT_CONTAINER_NAME, containerOptions);
  md.inline.ruler.before("link", BRACKET_SPAN_RULE, bracketSpanRule);
  return md;
}

/**
 * image 토큰의 보이는 글자. markdown-it은 `content`에 라벨 원문(`*강조*` · `\\*` 그대로)을 넣고
 * 렌더된 글자는 children에 둔다 — 저장(alt · caption)과 길이 검사가 같은 값을 보도록 여기 하나로 모은다.
 */
export function imageAltText(tok: Token): string {
  return (tok.children ?? [])
    .map((child) => {
      switch (child.type) {
        case "text":
        case "text_special": // `\\*` 같은 이스케이프 글자
        case "code_inline":
          return child.content;
        case "image":
          return imageAltText(child);
        // 대체 글자에는 마크가 없다 — 괄호 span 모양은 해석하지 않고 원문 그대로 둔다
        case "span_open":
          return "[";
        case "span_close":
          return `]{${(child.meta as SpanOpenMeta).body}}`;
        case "softbreak":
        case "hardbreak":
          return " ";
        default:
          return "";
      }
    })
    .join("");
}
