import MarkdownIt from "markdown-it";
import container from "markdown-it-container";

export const CALLOUT_CONTAINER_NAME = "callout";

/**
 * 콜아웃 컨테이너 마커의 첫 단어만 검사한다(tone 값은 여기서 안 본다) — tone이 정의 밖이어도
 * `:::callout tone=danger`를 컨테이너로 인식해야 check.ts가 "정의 밖 tone" 오류를 낼 수 있다
 * (markdown-it-container의 기본 validate는 marker 뒤 전체를 이름과 비교해 안 맞으면 그냥 문단
 * 글자로 흘려보낸다 — 그러면 오류가 조용히 사라진다, adr-013).
 */
function validateCalloutMarker(params: string): boolean {
  return params.trim().split(/\s+/, 1)[0] === CALLOUT_CONTAINER_NAME;
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
  // @ts-expect-error -- markdown-it-container의 타입 선언은 markdown-it을 require()로 다시
  // import해 우리가 쓰는 markdown-it의 ESM 타입과 이름은 같지만 다른 타입으로 취급된다(dual
  // package hazard). prosemirror-markdown도 같은 이유로 markdown-it import 위에 @ts-ignore를
  // 둔다(node_modules/prosemirror-markdown/src/from_markdown.ts) — 실행 시 동작은 같다.
  md.use(container, CALLOUT_CONTAINER_NAME, { validate: validateCalloutMarker });
  return md;
}
