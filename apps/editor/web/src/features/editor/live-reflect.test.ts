import type { Doc } from "@blog-editor/content-schema";
import { changedTopBlocks, liveReflectActionOf } from "./live-reflect";

const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const docOf = (...texts: string[]) => ({ type: "doc", content: texts.map(paragraph) }) as Doc;

describe("web-edit-screen — 열린 편집 화면이 다른 곳에서 바뀐 초안을 알아챈다", () => {
  it.each([
    // 서버 revision이 내가 가진 것(불러온 판 · 내 마지막 저장)과 같으면 자기 저장이다 — 조합 중이어도 무시
    { serverRevision: "r1", hasUnsavedChanges: true, isComposing: true, action: "ignore" },
    { serverRevision: "r2", hasUnsavedChanges: false, isComposing: false, action: "replace" },
    { serverRevision: "r2", hasUnsavedChanges: true, isComposing: false, action: "notify" },
    { serverRevision: "r2", hasUnsavedChanges: false, isComposing: true, action: "defer" },
  ] as const)(
    "WHEN 서버 $serverRevision · 내 판 r1 · 고침 $hasUnsavedChanges · 조합 $isComposing THEN $action",
    ({ action, ...input }) => {
      expect(liveReflectActionOf({ ...input, knownRevision: "r1" })).toBe(action);
    },
  );

  it("WHEN 둘째 블록이 바뀌고 넷째 블록이 붙으면 THEN 바뀐 최상위 블록 번호는 [1, 3]이다", () => {
    const before = docOf("첫 문단", "둘째 문단", "셋째 문단");
    const after = docOf("첫 문단", "AI가 고친 둘째 문단", "셋째 문단", "AI가 붙인 넷째 문단");

    expect(changedTopBlocks(before, after)).toEqual([1, 3]);
  });
});
