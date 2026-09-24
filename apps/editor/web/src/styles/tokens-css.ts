/**
 * design/tokens.json → `:root` CSS 변수(design.md 4). 이 결과가 web의 코드 토큰 정본(`tokens.css`)이고,
 * 테스트가 저장된 파일과 같은지 확인한다. 이름은 editor-react · content-render CSS가 이미 쓰는 것에 맞춘다.
 */

// 글꼴 토큰 이름 → CSS 변수 이름(editor-react · post.css가 `--font-sans`를 쓴다)
const FONT_FAMILY_VARIABLES: Readonly<Record<string, string>> = {
  body: "font-sans",
  display: "font-display",
  hand: "font-hand",
};

// post.css는 사이트 쪽 이름 `--brand`를 쓴다 — 에디터 토큰에서는 `brand-ink`와 같은 색이다
const ALIASES: ReadonlyArray<readonly [string, string]> = [["brand", "var(--brand-ink)"]];

const SPACE_PREFIX = "space-";

const PX_LENGTH = /^(\d+(?:\.\d+)?)px$/;
const ROOT_FONT_SIZE_PX = 16;

const HEADER =
  "/* 생성 파일 — 고치지 말고 design/tokens.json을 바꾼 뒤 `pnpm --filter @blog-editor/web tokens`. */";

type Group = Readonly<Record<string, unknown>>;

export function tokensToCss(tokens: unknown): string {
  const root = asGroup(tokens);
  const lines = [
    ...colorLines(asGroup(root.color)),
    ...fontLines(asGroup(root.font)),
    ...lengthLines(asGroup(root.size), ""),
    ...lengthLines(asGroup(root.space), SPACE_PREFIX),
    ...ALIASES.map(([name, value]) => declaration(name, value)),
  ];
  return `${HEADER}\n\n:root {\n${lines.join("\n")}\n}\n`;
}

function colorLines(color: Group): string[] {
  return stringEntries(color).map(([name, value]) => declaration(name, value));
}

function fontLines(font: Group): string[] {
  return stringEntries(font).flatMap(([name, value]) => {
    const variable = FONT_FAMILY_VARIABLES[name];
    return variable === undefined ? [] : [declaration(variable, doubleQuoted(value))];
  });
}

// 간격 척도는 px 값이 이름이다(`space.8` → `--space-8`) — 단계 번호와 헷갈리지 않게 접두사를 붙인다
function lengthLines(group: Group, prefix: string): string[] {
  return stringEntries(group).flatMap(([name, value]) => {
    const rem = pxToRem(value);
    return rem === null ? [] : [declaration(`${prefix}${name}`, rem)];
  });
}

// prettier(format:check)가 CSS 문자열을 큰따옴표로 바꾼다 — 생성 결과가 그 모양이어야 저장본과 같다
function doubleQuoted(value: string): string {
  return value.replaceAll("'", '"');
}

function pxToRem(value: string): string | null {
  const match = PX_LENGTH.exec(value.trim());
  if (match === null) return null;
  return `${Number(match[1]) / ROOT_FONT_SIZE_PX}rem`;
}

function declaration(name: string, value: string): string {
  return `  --${name}: ${value};`;
}

function stringEntries(group: Group): Array<[string, string]> {
  return Object.entries(group).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
}

function asGroup(value: unknown): Group {
  return typeof value === "object" && value !== null ? (value as Group) : {};
}
