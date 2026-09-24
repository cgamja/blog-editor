import { fixtures } from "@blog-editor/content-schema";
import { restoreDecisionOf } from "./local-draft";
import type { LocalDraft } from "./types";

const draftOn = (baseRevision: string): LocalDraft => ({
  baseRevision,
  slug: "beta-open",
  meta: fixtures.minimal.meta,
  doc: fixtures.minimal.doc,
  savedAt: "2026-09-24T06:42:00.000Z",
});

describe("web-post-save — 브라우저에 남은 글 되살리기", () => {
  it("WHEN 기준 r1인 localDraft와 서버 r1을 보면 THEN 되살리기다", () => {
    expect(restoreDecisionOf(draftOn("r1"), "r1")).toBe("restore");
  });

  it("WHEN 기준 r1인 localDraft와 서버 r2를 보면 THEN 충돌이다", () => {
    expect(restoreDecisionOf(draftOn("r1"), "r2")).toBe("conflict");
  });

  it("WHEN localDraft 없이 보면 THEN 그대로다", () => {
    expect(restoreDecisionOf(null, "r1")).toBe("none");
  });
});
