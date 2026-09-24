/**
 * 토큰 외 CSS 값 검사(#116, adr-025). 색 · 간격 · 선 두께 · 글자 크기는 tokens.css 변수로만 쓴다.
 * 손으로 쓴 CSS 몇 개만 보면 되므로 CSS 파서 대신 선언 단위로 자른다 — 주석 · 문자열을 먼저 지워
 * 선택자 · 미디어 쿼리 · 주석 속 값이 선언으로 읽히지 않게 한다.
 */

export interface TokenViolation {
  line: number;
  property: string;
  value: string;
  reason: string;
}

/**
 * 척도 밖 값은 `/* token-lint-ignore: <이유> *\/`로 선언 하나에만 예외를 준다 — 같은 줄에 선언과 함께 있으면
 * 주석 바로 앞 선언(앞에 없으면 바로 뒤 선언), 주석만 있는 윗줄이면 다음 줄의 첫 선언.
 * 표시는 주석 맨 앞, 이유는 글자 · 숫자가 하나 이상.
 */
const IGNORE_MARKER = /^\/\*\s*token-lint-ignore\b/;
const IGNORE_REASON = /^\/\*\s*token-lint-ignore\s*:(.*?)\*\/$/s;
const REASON_CHARACTER = /[\p{L}\p{N}]/u;

const COLOR_LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i;
/** 값 전체가 색 하나인 속성 — 허용 목록 밖 식별자는 전부 색 이름이다 */
const PURE_COLOR_PROPERTY =
  /^(?:color|background-color|border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?-color|outline-color|fill|stroke|caret-color|accent-color|text-decoration-color)$/;
/**
 * 순수 색 속성에 올 수 있는 색 아닌 값: 전역 키워드 · 색 키워드 · fill/stroke의 none · caret/accent의 auto,
 * 그리고 사용자 환경을 따르는 시스템 색(CSS Color 4 §6.2 — 강제 색 모드에서 토큰보다 이것이 맞다).
 */
const PURE_COLOR_ALLOWED = new Set([
  ...["inherit", "initial", "unset", "revert", "revert-layer"],
  ...["transparent", "currentcolor", "none", "auto", "context-fill", "context-stroke"],
  ...["canvas", "canvastext", "linktext", "visitedtext", "activetext", "buttonface", "buttontext"],
  ...["buttonborder", "field", "fieldtext", "highlight", "highlighttext", "selecteditem"],
  ...["selecteditemtext", "mark", "marktext", "graytext", "accentcolor", "accentcolortext"],
]);
/** 줄임 속성은 다른 낱말(solid · no-repeat · inset)과 섞이므로 색 이름 목록으로만 본다 */
const SHORTHAND_COLOR_PROPERTY =
  /^(?:background|border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?|outline|box-shadow|text-shadow|text-decoration|column-rule)$/;
/** CSS Color 4 §6.1 이름 있는 색 */
const NAMED_COLORS = new Set(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown " +
    "burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan " +
    "darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid " +
    "darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet " +
    "deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro " +
    "ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki " +
    "lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow " +
    "lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray " +
    "lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine " +
    "mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise " +
    "mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab " +
    "orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru " +
    "pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown " +
    "seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan " +
    "teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen"
  ).split(" "),
);

/** px · rem만 척도 값으로 본다. em · % · vw · dvh · ch는 부모나 화면에 비례하는 다른 뜻이라 대상이 아니다 */
const ABSOLUTE_LENGTH = /(?<![\w.-])-?(\d*\.?\d+)(px|rem)\b/gi;
const SPACING_PROPERTY = /^(?:(?:margin|padding)(?:-.+)?|(?:row-|column-)?gap|inset(?:-.+)?)$/;
const BORDER_WIDTH_PROPERTY =
  /^(?:border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?(?:-width)?|outline(?:-width|-offset)?)$/;
const FONT_SIZE_PROPERTY = /^(?:font-size|font)$/;
const IDENTIFIER = /(?<![\w-])-?[a-z_][\w-]*/gi;
const IMPORTANT = /!\s*important\s*$/i;

interface Declaration {
  property: string;
  value: string;
  line: number;
  start: number;
  end: number;
  endLine: number;
}

interface CommentSpan {
  text: string;
  start: number;
  startLine: number;
  endLine: number;
  /** 주석 앞뒤 모두 공백인 줄 — 다음 줄 첫 선언에 붙는다. 아니면 같은 줄의 앞(없으면 뒤) 선언에 붙는다 */
  standalone: boolean;
}

type IgnoreStatus = "with-reason" | "without-reason";

export function findTokenViolations(css: string): TokenViolation[] {
  const { blanked, comments } = blankCommentsAndStrings(css);
  const declarations = declarationsOf(blanked);
  const ignores = ignoresByDeclaration(declarations, comments);
  const violations: TokenViolation[] = [];
  declarations.forEach((declaration, index) => {
    const reason = violationReason(declaration);
    if (reason === null) return;
    const ignore = ignores.get(index);
    if (ignore === "with-reason") return;
    violations.push({
      line: declaration.line,
      property: declaration.property,
      value: declaration.value,
      reason:
        ignore === "without-reason"
          ? `${reason} — 예외 주석은 "token-lint-ignore: <이유>" 꼴이어야 한다`
          : reason,
    });
  });
  return violations;
}

/** 주석 · 문자열 내용을 같은 길이의 공백으로 바꾼다 — 줄 번호와 위치가 그대로 남는다 */
function blankCommentsAndStrings(css: string): { blanked: string; comments: CommentSpan[] } {
  const comments: CommentSpan[] = [];
  let blanked = "";
  let line = 1;
  let index = 0;
  const blank = (text: string) => text.replace(/[^\n]/g, " ");
  while (index < css.length) {
    if (css.startsWith("/*", index)) {
      const end = css.indexOf("*/", index + 2);
      const stop = end === -1 ? css.length : end + 2;
      const text = css.slice(index, stop);
      const newlines = text.split("\n").length - 1;
      const lineStart = css.lastIndexOf("\n", index - 1) + 1;
      const lineEnd = css.indexOf("\n", stop);
      const after = css.slice(stop, lineEnd === -1 ? css.length : lineEnd);
      const standalone = css.slice(lineStart, index).trim() === "" && after.trim() === "";
      comments.push({ text, start: index, startLine: line, endLine: line + newlines, standalone });
      blanked += blank(text);
      line += newlines;
      index = stop;
      continue;
    }
    const char = css[index] ?? "";
    if (char === '"' || char === "'") {
      let stop = index + 1;
      while (stop < css.length && css[stop] !== char) stop += css[stop] === "\\" ? 2 : 1;
      const inner = css.slice(index + 1, stop);
      blanked += char + blank(inner) + (stop < css.length ? char : "");
      line += inner.split("\n").length - 1;
      index = stop + 1;
      continue;
    }
    if (char === "\n") line += 1;
    blanked += char;
    index += 1;
  }
  return { blanked, comments };
}

/**
 * `{` 앞 조각은 선택자 · at 규칙 머리라 건너뛰고, `}` · 괄호 밖 `;` 앞 조각 중 `:`가 있는 것만 선언이다.
 * 괄호 안 `;`(`url(data:…;base64,…)`)에서는 자르지 않는다.
 */
function declarationsOf(blanked: string): Declaration[] {
  const declarations: Declaration[] = [];
  const lineAt = (offset: number) => blanked.slice(0, offset).split("\n").length;
  let segmentStart = 0;
  let depth = 0;
  for (let index = 0; index <= blanked.length; index += 1) {
    const char = blanked[index];
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    const boundary =
      index === blanked.length || char === "{" || char === "}" || (char === ";" && depth === 0);
    if (!boundary) continue;
    const segment = blanked.slice(segmentStart, index);
    const colon = segment.indexOf(":");
    if (char !== "{" && colon !== -1) {
      const start = segmentStart + segment.length - segment.trimStart().length;
      declarations.push({
        property: segment.slice(0, colon).trim().toLowerCase(),
        value: segment.slice(colon + 1).trim(),
        line: lineAt(start),
        start,
        end: index,
        endLine: lineAt(index),
      });
    }
    if (char === "{" || char === "}") depth = 0;
    segmentStart = index + 1;
  }
  return declarations;
}

function ignoresByDeclaration(
  declarations: Declaration[],
  comments: CommentSpan[],
): Map<number, IgnoreStatus> {
  const ignores = new Map<number, IgnoreStatus>();
  for (const comment of comments) {
    if (!IGNORE_MARKER.test(comment.text)) continue;
    const target = comment.standalone
      ? declarations.findIndex((d) => d.line === comment.endLine + 1)
      : sameLineTarget(declarations, comment);
    if (target !== -1) ignores.set(target, ignoreStatusOf(comment.text));
  }
  return ignores;
}

/** 같은 줄 주석: 주석 앞에서 끝나는 마지막 선언, 앞에 없으면 주석 뒤 같은 줄에서 시작하는 첫 선언 */
function sameLineTarget(declarations: Declaration[], comment: CommentSpan): number {
  const before = lastIndexWhere(
    declarations,
    (d) => d.start < comment.start && d.endLine === comment.startLine,
  );
  if (before !== -1) return before;
  return declarations.findIndex((d) => d.start > comment.start && d.line === comment.endLine);
}

/** Array.prototype.findLastIndex는 ES2023 — tsconfig.base의 lib 밖이다 */
function lastIndexWhere<T>(items: T[], matches: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item !== undefined && matches(item)) return index;
  }
  return -1;
}

function ignoreStatusOf(text: string): IgnoreStatus {
  const reason = IGNORE_REASON.exec(text)?.[1] ?? "";
  return REASON_CHARACTER.test(reason) ? "with-reason" : "without-reason";
}

function violationReason({ property, value }: Declaration): string | null {
  const checked = withoutFallbacksAndUrls(value.replace(IMPORTANT, ""));
  if (COLOR_LITERAL.test(checked)) return "색 리터럴 — 색 토큰을 쓴다";
  if (colorNameIn(property, checked)) return "이름 있는 색 — 색 토큰을 쓴다";
  if (!hasNonZeroAbsoluteLength(checked)) return null;
  if (property.startsWith("--"))
    return "범위 변수의 길이 리터럴 — 토큰을 쓰거나 예외 주석에 이유를 적는다";
  if (SPACING_PROPERTY.test(property)) return "간격 리터럴 — --space-* 토큰을 쓴다";
  if (BORDER_WIDTH_PROPERTY.test(property))
    return "선 두께 리터럴 — --border-width · --focus-ring-* 토큰을 쓴다";
  if (FONT_SIZE_PROPERTY.test(property)) return "글자 크기 리터럴 — --font-size-* 토큰을 쓴다";
  return null;
}

function colorNameIn(property: string, value: string): boolean {
  if (PURE_COLOR_PROPERTY.test(property)) {
    return identifiersOf(withoutFunctionCalls(value)).some((word) => !PURE_COLOR_ALLOWED.has(word));
  }
  if (SHORTHAND_COLOR_PROPERTY.test(property) || property.startsWith("--")) {
    return identifiersOf(value).some((word) => NAMED_COLORS.has(word));
  }
  return false;
}

function identifiersOf(value: string): string[] {
  return [...value.matchAll(IDENTIFIER)]
    .map((match) => match[0].toLowerCase())
    .filter((word) => !word.startsWith("--"));
}

/** `var(--ink)` · `color-mix(…)` 같은 함수 호출을 통째로 뺀다 — 함수 이름과 인자는 색 이름이 아니다 */
function withoutFunctionCalls(value: string): string {
  let result = "";
  let index = 0;
  while (index < value.length) {
    const call = /^[a-z-]+\(/i.exec(value.slice(index));
    if (call === null) {
      result += value[index];
      index += 1;
      continue;
    }
    index = matchingParen(value, index + call[0].length - 1) + 1;
    result += " ";
  }
  return result;
}

function hasNonZeroAbsoluteLength(value: string): boolean {
  return [...value.matchAll(ABSOLUTE_LENGTH)].some((match) => Number(match[1]) !== 0);
}

/** `var(--x, fallback)`의 fallback과 `url(...)` 안은 검사하지 않는다 — fallback은 토큰이 없을 때의 안전값이다 */
function withoutFallbacksAndUrls(value: string): string {
  let result = "";
  let index = 0;
  while (index < value.length) {
    const fn = /^(var|url)\(/i.exec(value.slice(index));
    if (fn === null) {
      result += value[index];
      index += 1;
      continue;
    }
    const close = matchingParen(value, index + fn[0].length - 1);
    const inner = value.slice(index + fn[0].length, close);
    if (fn[1]?.toLowerCase() === "url") {
      result += "url()";
    } else {
      const comma = topLevelComma(inner);
      result += `var(${comma === -1 ? inner : inner.slice(0, comma)})`;
    }
    index = close + 1;
  }
  return result;
}

function matchingParen(text: string, open: number): number {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === "(") depth += 1;
    if (text[index] === ")") depth -= 1;
    if (depth === 0) return index;
  }
  return text.length;
}

function topLevelComma(text: string): number {
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "(") depth += 1;
    if (text[index] === ")") depth -= 1;
    if (text[index] === "," && depth === 0) return index;
  }
  return -1;
}
