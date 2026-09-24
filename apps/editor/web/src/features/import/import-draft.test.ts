import { SCHEMA_VERSION, fixtures } from "@blog-editor/content-schema";
import { MARKDOWN_FILE_MAX_BYTES } from "./constants";
import {
  buildImportedPost,
  canCreateDraft,
  markdownFileProblem,
  suggestSlug,
} from "./import-draft";
import type { DraftInput, ImportPreview } from "./types";

const INPUT: DraftInput = {
  slug: "sleep-log",
  title: "수면 기록",
  description: "밤잠이 길어지고 있어요.",
  category: "parenting",
  date: "2026-09-24",
};

const CONVERTED: ImportPreview = {
  ok: true,
  doc: fixtures.minimal.doc,
  html: "<p>밤잠</p>",
  suggested: { title: "수면 기록", description: "밤잠이 길어지고 있어요." },
};

describe("web-import — 가져오기는 미리보기가 통과한 것만 초안으로 만든다", () => {
  it("WHEN 변환된 doc과 제목 · 설명 · 카테고리 · 날짜로 초안 파일을 만들면 THEN 현재 저장 형식 버전 · draft true · source editor이고 그 doc · 메타를 담는다", () => {
    const file = buildImportedPost(fixtures.minimal.doc, INPUT);

    expect(file).toEqual({
      schemaVersion: SCHEMA_VERSION,
      meta: {
        title: INPUT.title,
        description: INPUT.description,
        date: INPUT.date,
        category: INPUT.category,
        draft: true,
        source: "editor",
      },
      doc: fixtures.minimal.doc,
    });
  });

  it("WHEN 제목 `Sleep Log: Week 1!`과 `수면 기록`으로 주소를 제안하면 THEN 차례로 sleep-log-week-1과 빈 문자열이다", () => {
    expect([suggestSlug("Sleep Log: Week 1!"), suggestSlug("수면 기록")]).toEqual([
      "sleep-log-week-1",
      "",
    ]);
  });

  it("WHEN 미리보기가 실패했거나 주소가 틀렸거나 제목이 비었으면 THEN 만들 수 없고, 성공한 미리보기와 맞는 입력이면 만들 수 있다", () => {
    const failed: ImportPreview = { ok: false, messages: ["블록 2 (3줄): 표는 정의 밖이다"] };

    expect([
      canCreateDraft(failed, INPUT),
      canCreateDraft(null, INPUT),
      canCreateDraft(CONVERTED, { ...INPUT, slug: "Sleep_Log" }),
      canCreateDraft(CONVERTED, { ...INPUT, title: "  " }),
      canCreateDraft(CONVERTED, INPUT),
    ]).toEqual([false, false, false, false, true]);
  });
});

describe("web-import — 가져올 파일은 마크다운 확장자와 크기 상한 안만 읽는다", () => {
  it("WHEN note.MD(작음) · note.txt · 상한을 넘는 big.md를 거르면 THEN 차례로 통과 · 확장자 문제 · 크기 문제다", () => {
    expect([
      markdownFileProblem({ name: "note.MD", size: 10 }),
      markdownFileProblem({ name: "note.txt", size: 10 }),
      markdownFileProblem({ name: "big.md", size: MARKDOWN_FILE_MAX_BYTES + 1 }),
    ]).toEqual([null, "extension", "size"]);
  });
});
