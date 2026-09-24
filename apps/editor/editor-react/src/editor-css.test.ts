/// <reference types="node" />
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./editor.css", import.meta.url), "utf8");

/** 주석을 뺀 `선택자 { 선언 }` 규칙들 — editor.css에는 at-rule이 없다. */
function rules(source: string): { selector: string; body: string }[] {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1]!.trim(),
    body: match[2]!,
  }));
}

describe("editor-react: 편집 중에는 움직임을 재생하지 않는다", () => {
  it("WHEN editor.css에서 선택자에 [data-motion]이 있는 규칙을 찾는다 THEN .blog-editor .ProseMirror [data-motion] 규칙이 animation-name: none을 선언한다", () => {
    const motionRules = rules(css).filter((rule) => rule.selector.includes("[data-motion]"));

    expect(motionRules.map((rule) => rule.selector)).toContain(
      ".blog-editor .ProseMirror [data-motion]",
    );
    expect(
      motionRules.find((rule) => rule.selector === ".blog-editor .ProseMirror [data-motion]")?.body,
    ).toMatch(/animation-name\s*:\s*none\s*;/);
  });
});
