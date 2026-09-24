import { fixtures } from "@blog-editor/content-schema";
import { editingStartOf } from "./editing-start";
import type { LocalDraft } from "./types";

const loaded = { file: fixtures.minimal, revision: "r2" };

const localOn = (baseRevision: string): LocalDraft => ({
  baseRevision,
  slug: "beta-open",
  meta: { ...fixtures.minimal.meta, title: "쓰던 제목" },
  doc: fixtures.minimal.doc,
  savedAt: "2026-09-24T06:42:00.000Z",
});

describe("web-post-save — 되살린 글의 기준 revision", () => {
  it("WHEN 그사이 서버가 r2로 바뀐 글에 r1 위에서 쓰던 글을 되살리면 THEN 충돌이고 저장 기준은 r1이다", () => {
    const start = editingStartOf(loaded, "beta-open", localOn("r1"));

    expect(start.restore).toBe("conflict");
    expect(start.meta.title).toBe("쓰던 제목");
    expect(start.revision).toBe("r1");
  });

  it("WHEN 같은 r2 위에서 쓰던 글을 되살리면 THEN 되살리기이고 저장 기준은 r2다", () => {
    const start = editingStartOf(loaded, "beta-open", localOn("r2"));

    expect(start.restore).toBe("restore");
    expect(start.revision).toBe("r2");
  });
});
