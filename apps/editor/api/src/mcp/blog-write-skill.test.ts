import { lstatSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import { convertMarkdown } from "@blog-editor/content-convert";

/**
 * 레포 스킬 `/blog-write`(.claude/skills/blog-write/SKILL.md)가 AI에게 보여 주는 markdown 예시는
 * check_draft와 같은 검사(convertMarkdown)를 통과해야 한다 — AI가 예시를 그대로 따라 써도 저장이 거부되지 않게.
 * 예시는 형식 가이드와 같은 `example` 펜스로 표시하고, 뽑는 규칙도 형식 가이드 추출기(content-convert convert.test.ts)와 같다.
 */
const SKILL_URL = new URL("../../../../../.claude/skills/blog-write/SKILL.md", import.meta.url);
// Codex는 `.agents/skills`를 읽는다 — 원본을 가리키는 심볼릭 링크 폴더(adr-035)
const CODEX_SKILL_DIR = new URL("../../../../../.agents/skills/blog-write", import.meta.url);
const CODEX_SKILL_URL = new URL(
  "../../../../../.agents/skills/blog-write/SKILL.md",
  import.meta.url,
);

function extractExampleBlocks(markdown: string): string[] {
  const lines = markdown.split("\n");
  const blocks: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const open = /^(`{3,})example$/.exec(lines[i]!);
    if (!open) continue;
    const fenceLength = open[1]!.length;
    let close = i + 1;
    for (; close < lines.length; close++) {
      const closeMatch = /^(`{3,})$/.exec(lines[close]!);
      if (closeMatch && closeMatch[1]!.length >= fenceLength) break;
    }
    blocks.push(lines.slice(i + 1, close).join("\n"));
    i = close;
  }
  return blocks;
}

describe("blog-write-skill", () => {
  it("WHEN SKILL.md의 example 블록을 하나씩 convertMarkdown에 넣으면 THEN 블록이 하나 이상이고 모두 ok · 메시지 없음이다", () => {
    const skill = readFileSync(SKILL_URL, "utf8");
    const blocks = extractExampleBlocks(skill);
    const openingFences = skill.split("\n").filter((line) => /^`{3,}example/.test(line)).length;

    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.length).toBe(openingFences);
    for (const block of blocks) {
      const result = convertMarkdown(block);
      expect(result.ok ? [] : result.messages, block).toEqual([]);
    }
  });

  it("WHEN Codex 경로(.agents/skills)의 SKILL.md를 읽으면 THEN 원본을 가리키는 링크이고 내용이 같다", () => {
    expect(lstatSync(CODEX_SKILL_DIR).isSymbolicLink()).toBe(true);
    expect(realpathSync(CODEX_SKILL_URL)).toBe(realpathSync(SKILL_URL));
    expect(readFileSync(CODEX_SKILL_URL, "utf8")).toBe(readFileSync(SKILL_URL, "utf8"));
    // 상대 링크여야 레포를 어디에 받아도 풀린다
    expect(readlinkSync(CODEX_SKILL_DIR)).toBe("../../.claude/skills/blog-write");
  });
});
