import { fixtures } from "@blog-editor/content-schema";
import type { AiUndoStore } from "./ai-undo-store";

/**
 * ai-undo 저장소 계약 스위트(openspec ai-undo · ADR-041) — Memory · File 구현이 같은 것을 통과한다
 * (post-store.contract.ts와 같은 관례). 구현별 테스트 파일이 저장소 만드는 법만 넘긴다.
 * 남긴 판 = AI 저장 직전 파일(`before`, 새 글이면 null) + 그 저장이 만든 revision(`after`).
 */
export function describeAiUndoStoreContract(name: string, createStore: () => Promise<AiUndoStore>) {
  describe(`${name} — ai-undo 저장소 계약`, () => {
    it("WHEN 남긴 판을 쓰고 같은 slug에 다시 쓰면 THEN 읽으면 마지막 판이고 before null도 그대로 읽는다", async () => {
      const store = await createStore();

      await store.put("beta-open", { before: fixtures.minimal, after: "revision-1" });
      await store.put("beta-open", { before: fixtures.allBlocks, after: "revision-2" });
      await store.put("new-post", { before: null, after: "revision-3" });

      expect(await store.get("beta-open")).toEqual({
        before: fixtures.allBlocks,
        after: "revision-2",
      });
      expect(await store.get("new-post")).toEqual({ before: null, after: "revision-3" });
    });

    it("WHEN 남긴 판을 지우거나 쓴 적 없는 slug를 읽으면 THEN null이고 없는 slug를 지워도 실패하지 않는다", async () => {
      const store = await createStore();
      await store.put("beta-open", { before: fixtures.minimal, after: "revision-1" });

      await store.delete("beta-open");
      await store.delete("never-written");

      expect(await store.get("beta-open")).toBeNull();
      expect(await store.get("never-written")).toBeNull();
    });
  });
}
