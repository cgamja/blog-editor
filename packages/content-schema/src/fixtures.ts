import type { PostFile } from "./post-file";
import { minimal, allBlocks, decorationMax } from "./fixtures.posts";
import { MAX_STICKERS_PER_DOC } from "./doc";

/** render · convert · API · 사이트 · Lighthouse 기준선이 같이 쓰는 대표 문서 3개(spec: document-fixtures). */
export type Fixtures = {
  minimal: PostFile;
  allBlocks: PostFile;
  decorationMax: PostFile;
};

/** at — 기대 실패 위치. zod issue path 배열(접두어로 일치) 또는 migrate가 던지는 경우 "migrate". */
export type InvalidFixture = {
  name: string;
  file: unknown;
  reason: string;
  at: readonly (string | number)[] | "migrate";
};

export const fixtures: Fixtures = { minimal, allBlocks, decorationMax };

/**
 * minimal을 깊은 복제해 field 하나만 깨뜨린다 — 그래서 각 invalid 픽스처는 정확히 한 가지
 * 이유로만 거부된다(spec: document-fixtures 보호 대상).
 */
function cloneMinimal(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(minimal)) as Record<string, unknown>;
}

function docOf(file: Record<string, unknown>): Record<string, unknown> {
  return file.doc as Record<string, unknown>;
}

function firstBlock(file: Record<string, unknown>): Record<string, unknown> {
  const content = docOf(file).content as Record<string, unknown>[];
  return content[0]!;
}

// javascript-link — href가 http(s)/mailto/내부 경로 허용 목록을 벗어난다.
const javascriptLinkFixture = cloneMinimal();
{
  const block = firstBlock(javascriptLinkFixture);
  const text = (block.content as Record<string, unknown>[])[0]!;
  text.marks = [{ type: "link", attrs: { href: "javascript:alert(1)" } }];
}

// absolute-image — 이미지가 경로가 아니라 절대 URL이다.
const absoluteImageFixture = cloneMinimal();
{
  const content = docOf(absoluteImageFixture).content as Record<string, unknown>[];
  content.push({
    type: "image",
    attrs: { src: "https://example.com/images/foo.webp", alt: "잘못된 절대 URL 이미지" },
  });
}

// unknown-attr — attrs 닫힌 집합에 없는 키.
const unknownAttrFixture = cloneMinimal();
{
  const block = firstBlock(unknownAttrFixture);
  block.attrs = { color: "red" };
}

// too-many-stickers — 문서 전체 스티커 합계가 상한을 하나 넘는다.
const tooManyStickersFixture = cloneMinimal();
{
  const block = firstBlock(tooManyStickersFixture);
  block.attrs = {
    stickers: Array.from({ length: MAX_STICKERS_PER_DOC + 1 }, () => ({
      id: "star-coral",
      x: 0,
      y: 0,
      size: 10,
      rotate: 0,
    })),
  };
}

// future-version — migrate가 지원하지 않는 미래 schemaVersion.
const futureVersionFixture = cloneMinimal();
futureVersionFixture.schemaVersion = 2;

export const invalidFixtures: ReadonlyArray<InvalidFixture> = [
  {
    name: "javascript-link",
    file: javascriptLinkFixture,
    reason: "javascript-link",
    at: ["doc", "content", 0, "content", 0, "marks", 0, "attrs", "href"],
  },
  {
    name: "absolute-image",
    file: absoluteImageFixture,
    reason: "absolute-image",
    at: ["doc", "content", 1, "attrs", "src"],
  },
  {
    name: "unknown-attr",
    file: unknownAttrFixture,
    reason: "unknown-attr",
    at: ["doc", "content", 0, "attrs"],
  },
  {
    name: "too-many-stickers",
    file: tooManyStickersFixture,
    reason: "too-many-stickers",
    at: ["doc", "content"],
  },
  {
    name: "future-version",
    file: futureVersionFixture,
    reason: "future-version",
    at: "migrate",
  },
];
