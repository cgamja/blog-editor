/**
 * design/tokens.json → `:root` CSS 변수(design.md 4). 이 결과가 web의 코드 토큰 정본(`tokens.css`)이고,
 * 테스트가 저장된 파일과 같은지 확인한다. 이름은 editor-react · content-render CSS가 이미 쓰는 것에 맞춘다.
 * 잘못된 토큰(이름 · 중복 · 간격 단위 · 색 형식)은 조용히 빼지 않고 생성을 멈춘다.
 */

// 글꼴 토큰 이름 → CSS 변수 이름(editor-react · post.css가 `--font-sans`를 쓴다)
const FONT_FAMILY_VARIABLES: Readonly<Record<string, string>> = {
  body: "font-sans",
  display: "font-display",
  hand: "font-hand",
};

// post.css는 사이트 쪽 이름 `--brand`를 쓴다 — 에디터 토큰에서는 `brand-ink`와 같은 색이다
const ALIASES: ReadonlyArray<Declaration> = [["brand", "var(--brand-ink)"]];

// 선 두께 · 포커스 고리는 글자 크기를 키워도 굵어지지 않아야 한다 — rem으로 바꾸지 않는다
const PX_FIXED_SIZES: ReadonlySet<string> = new Set([
  "border-width",
  "focus-ring-width",
  "focus-ring-offset",
]);

const SPACE_PREFIX = "space-";
const FONT_SIZE_PREFIX = "font-size-";
const SHADOW_PREFIX = "shadow-";

// 그림자 한 겹: `<x> <y> <blur> [<spread>] <색 토큰 이름> <불투명도>%` — 색은 색 토큰을 섞어 쓴다
const SHADOW_LAYER = /^((?:-?\d+(?:\.\d+)?(?:px)?\s+){3,4})([a-z0-9-]+)\s+(\d{1,3})%$/;
const MAX_PERCENT = 100;

const TOKEN_NAME = /^[a-z0-9-]+$/;
const COLOR_VALUE = /^(#[0-9a-f]{3,8}|rgba?\([\d.,%\s]+\))$/i;
const PX_LENGTH = /^(\d+(?:\.\d+)?)px$/;
const ROOT_FONT_SIZE_PX = 16;

const HEADER =
  "/* 생성 파일 — 고치지 말고 design/tokens.json을 바꾼 뒤 `pnpm --filter @blog-editor/web tokens`. */";

type Group = Readonly<Record<string, unknown>>;
type Declaration = readonly [name: string, value: string];

export function tokensToCss(tokens: unknown): string {
  const root = asGroup(tokens);
  const color = asGroup(root.color);
  const declarations = [
    ...colorDeclarations(color),
    ...fontDeclarations(asGroup(root.font)),
    ...sizeDeclarations(asGroup(root.size)),
    ...spaceDeclarations(asGroup(root.space)),
    ...shadowDeclarations(asGroup(root.shadow), new Set(Object.keys(color))),
    ...ALIASES,
  ];
  assertUniqueNames(declarations);
  const lines = declarations.map(([name, value]) => `  --${name}: ${value};`);
  return `${HEADER}\n\n:root {\n${lines.join("\n")}\n}\n`;
}

function colorDeclarations(color: Group): Declaration[] {
  return validatedEntries(color).map(([name, value]) => {
    if (!COLOR_VALUE.test(value)) throw new TokenError(`색 ${name}: hex · rgb가 아니다 (${value})`);
    return [name, value];
  });
}

// font에는 글꼴 이름 · 글자 크기(px) · 설명 값(`17px/1.85` · `34-36px`)이 섞여 있다 — 설명 값은 건너뛴다
function fontDeclarations(font: Group): Declaration[] {
  return validatedEntries(font).flatMap(([name, value]): Declaration[] => {
    const variable = FONT_FAMILY_VARIABLES[name];
    if (variable !== undefined) return [[variable, doubleQuoted(value)]];
    const px = pxOf(value);
    return px === null ? [] : [[`${FONT_SIZE_PREFIX}${name}`, toRem(px)]];
  });
}

// size에는 길이가 아닌 설명 값(article-body 같은 글꼴 줄 등)도 있다 — px 길이만 내보낸다
function sizeDeclarations(size: Group): Declaration[] {
  return validatedEntries(size).flatMap(([name, value]): Declaration[] => {
    const px = pxOf(value);
    if (px === null) return [];
    return [[name, PX_FIXED_SIZES.has(name) ? `${px}px` : toRem(px)]];
  });
}

// 간격 척도는 px 값이 이름이다(`space.8` → `--space-8`) — 단계 번호와 헷갈리지 않게 접두사를 붙인다
function spaceDeclarations(space: Group): Declaration[] {
  return validatedEntries(space).map(([name, value]) => {
    const px = pxOf(value);
    if (px === null) throw new TokenError(`간격 ${name}: px가 아니다 (${value})`);
    return [`${SPACE_PREFIX}${name}`, toRem(px)];
  });
}

// 여러 겹은 `, `로 잇는다. 없는 색 이름 · 모양이 다른 겹은 조용히 빼지 않고 멈춘다
function shadowDeclarations(shadow: Group, colorNames: ReadonlySet<string>): Declaration[] {
  return validatedEntries(shadow).map(([name, value]) => {
    const layers = value.split(",").map((layer) => {
      const match = SHADOW_LAYER.exec(layer.trim());
      if (match === null) throw new TokenError(`그림자 ${name}: 모양이 다르다 (${layer.trim()})`);
      const [, offsets = "", colorName = "", percent = ""] = match;
      if (!colorNames.has(colorName)) {
        throw new TokenError(`그림자 ${name}: 색 토큰 ${colorName}이 없다`);
      }
      if (Number(percent) > MAX_PERCENT) throw new TokenError(`그림자 ${name}: ${percent}%`);
      return `${offsets}color-mix(in srgb, var(--${colorName}) ${percent}%, transparent)`;
    });
    return [`${SHADOW_PREFIX}${name}`, layers.join(", ")];
  });
}

function assertUniqueNames(declarations: readonly Declaration[]): void {
  const seen = new Set<string>();
  for (const [name] of declarations) {
    if (seen.has(name)) throw new TokenError(`CSS 변수 --${name}이 두 번 나온다`);
    seen.add(name);
  }
}

// prettier(format:check)가 CSS 문자열을 큰따옴표로 바꾼다 — 생성 결과가 그 모양이어야 저장본과 같다
function doubleQuoted(value: string): string {
  return value.replaceAll("'", '"');
}

function pxOf(value: string): number | null {
  const match = PX_LENGTH.exec(value.trim());
  return match === null ? null : Number(match[1]);
}

function toRem(px: number): string {
  return `${px / ROOT_FONT_SIZE_PX}rem`;
}

function validatedEntries(group: Group): Array<[string, string]> {
  return Object.entries(group)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([name, value]) => {
      if (!TOKEN_NAME.test(name)) throw new TokenError(`토큰 이름 ${name}: [a-z0-9-]만 쓴다`);
      return [name, value];
    });
}

function asGroup(value: unknown): Group {
  return typeof value === "object" && value !== null ? (value as Group) : {};
}

class TokenError extends Error {
  override name = "TokenError";
}
