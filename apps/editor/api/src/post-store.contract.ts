import { fixtures } from "@blog-editor/content-schema";
import type { PostFile } from "@blog-editor/content-schema";
import { ConflictError } from "./store";
import type { PostStore } from "./store";

function withTitle(file: PostFile, title: string): PostFile {
  return { ...file, meta: { ...file.meta, title } };
}

/**
 * post-store 계약 스위트(spec: post-store) — Memory · File · (M4) S3 구현이 전부 이것을 통과한다(adr-004).
 * 구현별 테스트 파일이 저장소 만드는 법만 넘긴다.
 */
export function describePostStoreContract(name: string, createStore: () => Promise<PostStore>) {
  describe(`${name} — post-store 계약`, () => {
    it("WHEN 새 글을 null로 쓰고 다시 읽으면 THEN 같은 file · revision이고 목록에 있다", async () => {
      const store = await createStore();

      const { revision } = await store.put("beta-open", fixtures.minimal, null);

      expect(await store.get("beta-open")).toEqual({ file: fixtures.minimal, revision });
      expect(await store.list()).toEqual([{ slug: "beta-open", meta: fixtures.minimal.meta }]);
    });

    it("WHEN 쓴 적 없는 slug를 읽으면 THEN null이다", async () => {
      const store = await createStore();

      expect(await store.get("never-written")).toBeNull();
    });

    it("WHEN 낡은 revision으로 쓰면 THEN ConflictError이고 최신 내용이 그대로다", async () => {
      const store = await createStore();
      const { revision: r1 } = await store.put("beta-open", fixtures.minimal, null);
      const updated = withTitle(fixtures.minimal, "고친 제목");
      const { revision: r2 } = await store.put("beta-open", updated, r1);

      await expect(
        store.put("beta-open", withTitle(fixtures.minimal, "늦은 저장"), r1),
      ).rejects.toBeInstanceOf(ConflictError);

      expect(r2).not.toBe(r1);
      expect(await store.get("beta-open")).toEqual({ file: updated, revision: r2 });
    });

    it("WHEN 있는 글에 null · 없는 글에 revision으로 쓰면 THEN 둘 다 ConflictError이고 바뀌지 않는다", async () => {
      const store = await createStore();
      const { revision } = await store.put("beta-open", fixtures.minimal, null);

      await expect(store.put("beta-open", fixtures.allBlocks, null)).rejects.toBeInstanceOf(
        ConflictError,
      );
      await expect(store.put("other-post", fixtures.allBlocks, revision)).rejects.toBeInstanceOf(
        ConflictError,
      );

      expect(await store.get("beta-open")).toEqual({ file: fixtures.minimal, revision });
      expect(await store.get("other-post")).toBeNull();
    });

    it("WHEN 같은 revision으로 두 쓰기를 동시에 시작하면 THEN 하나만 성공하고 그 내용이 남는다", async () => {
      const store = await createStore();
      const { revision } = await store.put("beta-open", fixtures.minimal, null);
      const first = withTitle(fixtures.minimal, "첫째");
      const second = withTitle(fixtures.minimal, "둘째");

      const results = await Promise.allSettled([
        store.put("beta-open", first, revision),
        store.put("beta-open", second, revision),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.reason).toBeInstanceOf(ConflictError);
      const winner = results[0]?.status === "fulfilled" ? first : second;
      expect((await store.get("beta-open"))?.file).toEqual(winner);
    });

    it("WHEN 맞는 revision으로 지우면 THEN 조회하면 null이고 목록에 없다", async () => {
      const store = await createStore();
      const { revision } = await store.put("beta-open", fixtures.minimal, null);

      await store.delete("beta-open", revision);

      expect(await store.get("beta-open")).toBeNull();
      expect(await store.list()).toEqual([]);
    });

    it("WHEN 한 번 고친 뒤 옛 revision으로 지우면 THEN ConflictError이고 고친 글이 그대로다", async () => {
      const store = await createStore();
      const { revision: stale } = await store.put("beta-open", fixtures.minimal, null);
      const updated = withTitle(fixtures.minimal, "고친 제목");
      const { revision } = await store.put("beta-open", updated, stale);

      await expect(store.delete("beta-open", stale)).rejects.toBeInstanceOf(ConflictError);

      expect(await store.get("beta-open")).toEqual({ file: updated, revision });
    });
  });
}
