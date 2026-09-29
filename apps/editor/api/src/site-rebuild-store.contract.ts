import type { SiteRebuildStore } from "./site-rebuild-store";

/**
 * 재빌드 상태 저장소 계약 스위트(openspec site-rebuild) — Memory · Supabase 구현이 같은 것을 통과한다
 * (post-store.contract.ts와 같은 관례). 구현별 테스트 파일이 저장소 만드는 법만 넘긴다.
 */
export function describeSiteRebuildStoreContract(
  name: string,
  createStore: () => Promise<SiteRebuildStore>,
) {
  describe(`${name} — site-rebuild 저장소 계약`, () => {
    it("WHEN 쓴 적 없는 저장소를 읽으면 THEN idle이고 요청 id · 시각이 없다", async () => {
      const store = await createStore();

      expect(await store.get()).toEqual({ status: "idle", requestId: null, updatedAt: null });
    });

    it("WHEN 상태를 두 번 쓰고 읽으면 THEN 마지막으로 쓴 상태 그대로다", async () => {
      const store = await createStore();
      await store.put({
        status: "pending",
        requestId: "request-1",
        updatedAt: "2026-09-29T01:00:00.000Z",
      });

      await store.put({
        status: "failed",
        requestId: "request-2",
        updatedAt: "2026-09-29T01:00:30.000Z",
      });

      expect(await store.get()).toEqual({
        status: "failed",
        requestId: "request-2",
        updatedAt: "2026-09-29T01:00:30.000Z",
      });
    });
  });
}
