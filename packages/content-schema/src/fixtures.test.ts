import { fixtures, invalidFixtures } from "./fixtures";
import { createPostFileSchema, migrate, MigrationError } from "./post-file";
import { normalize } from "./normalize";
import { SCHEMA_VERSION } from "./meta";
import { BLOG_CATEGORIES } from "./categories.test.helpers";

/**
 * document-fixtures spec은 #### Scenario 3개 — 1:1로 옮긴다.
 *
 * document-schema Requirement 1이 나열하는 노드는 doc을 뺀 15종(paragraph·heading·bulletList·
 * orderedList·blockquote·codeBlock·horizontalRule·image·callout·appScreenshot·table·listItem·
 * tableRow·tableCell·text)이다. fixtures spec 제목의 "11종"은 이 나열과 어긋난다 — spec.md를
 * 고치지 않고, 스키마 Requirement가 실제로 정의한 전체 집합을 기준으로 커버리지를 검사한다(notes에 기록).
 */

const schema = createPostFileSchema({ categories: BLOG_CATEGORIES });

function isSamePath(actual: readonly PropertyKey[], expected: readonly (string | number)[]) {
  return actual.length === expected.length && expected.every((seg, i) => actual[i] === seg);
}

const ALL_NODE_TYPES = [
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "image",
  "callout",
  "appScreenshot",
  "table",
  "listItem",
  "tableRow",
  "tableCell",
  "text",
];
const ALL_MARK_TYPES = ["bold", "italic", "code", "link", "strike", "underline", "textStyle"];

function collectTypes(node: unknown, nodeTypes: Set<string>, markTypes: Set<string>) {
  if (node === null || typeof node !== "object") return;
  const record = node as { type?: unknown; content?: unknown; marks?: unknown };
  if (typeof record.type === "string") nodeTypes.add(record.type);
  if (Array.isArray(record.content)) {
    for (const child of record.content) collectTypes(child, nodeTypes, markTypes);
  }
  if (Array.isArray(record.marks)) {
    for (const mark of record.marks) {
      const markRecord = mark as { type?: unknown };
      if (typeof markRecord.type === "string") markTypes.add(markRecord.type);
    }
  }
}

describe("document-fixtures — 유효 픽스처 셋은 스키마와 정규형을 통과한다", () => {
  it("WHEN 세 픽스처를 파싱하고 normalize와 비교하면 THEN 모두 success이고 이미 정규형이며 현재 버전이다", () => {
    for (const postFile of [fixtures.minimal, fixtures.allBlocks, fixtures.decorationMax]) {
      const result = schema.safeParse(postFile);
      expect(result.success).toBe(true);
      expect(normalize(postFile.doc)).toEqual(postFile.doc);
      expect(postFile.schemaVersion).toBe(SCHEMA_VERSION);
    }
  });

  it("WHEN allBlocks.doc를 순회해 노드·마크 type을 모으면 THEN 스키마가 정의한 전체 노드·마크 종류가 다 나타난다", () => {
    const nodeTypes = new Set<string>();
    const markTypes = new Set<string>();
    collectTypes(fixtures.allBlocks.doc, nodeTypes, markTypes);

    for (const type of ALL_NODE_TYPES) expect(nodeTypes.has(type)).toBe(true);
    for (const type of ALL_MARK_TYPES) expect(markTypes.has(type)).toBe(true);
  });
});

describe("document-fixtures — 잘못된 문서 픽스처는 이유와 함께 거부된다 (보호 대상)", () => {
  it("WHEN 각 invalidFixtures[i].file을 migrate 후 파싱하면 THEN 다섯 경우 모두 실패하고 실패 위치가 at과 일치한다", () => {
    const REQUIRED_REASONS = [
      "javascript-link",
      "absolute-image",
      "unknown-attr",
      "too-many-stickers",
      "future-version",
    ];
    const reasons = invalidFixtures.map((fixture) => fixture.reason);
    for (const required of REQUIRED_REASONS) expect(reasons).toContain(required);

    for (const fixture of invalidFixtures) {
      if (fixture.at === "migrate") {
        expect(() => migrate(fixture.file)).toThrow(MigrationError);
        continue;
      }
      const migrated = migrate(fixture.file);
      const result = schema.safeParse(migrated);
      expect(result.success).toBe(false);
      if (result.success) continue;
      const at = fixture.at;
      // 접두어 일치면 스티커 상한 refine 대신 다른 원인(예: size 범위)으로 실패해도 초록이 된다 — 정확 일치
      expect(result.error.issues.some((issue) => isSamePath(issue.path, at))).toBe(true);
    }
  });
});
