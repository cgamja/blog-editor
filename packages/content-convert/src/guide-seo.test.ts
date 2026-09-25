/// <reference types="node" />
import { readFileSync } from "node:fs";
import { SEO_LEVELS, scoreSeo } from "@blog-editor/content-schema";
import type { SeoLevel } from "@blog-editor/content-schema";

/** 형식 가이드 §4 감점 표의 한 줄 — "| `must`   | 25   |" */
const PENALTY_ROW = /^\|\s*`(must|should|info)`\s*\|\s*(\d+)\s*\|$/;

function guidePenalties(): Map<string, number> {
  const guide = readFileSync(new URL("../guide/format.md", import.meta.url), "utf8");
  const rows = guide.split("\n").flatMap((line) => {
    const match = PENALTY_ROW.exec(line.trim());
    return match === null ? [] : [[match[1]!, Number(match[2])] as const];
  });
  return new Map(rows);
}

describe("seo-check — 형식 가이드의 감점 표", () => {
  it("WHEN 가이드 §4 감점 표를 읽으면 THEN 등급마다 scoreSeo가 깎는 값과 같다", () => {
    const penalties = guidePenalties();

    expect([...penalties.keys()].sort()).toEqual([...SEO_LEVELS].sort());
    for (const level of SEO_LEVELS) {
      const one = [
        {
          level: level as SeoLevel,
          rule: "image-alt",
          target: { kind: "body" },
          message: "",
          fix: "",
        } as const,
      ];
      expect(100 - scoreSeo(one)).toBe(penalties.get(level));
    }
  });
});
