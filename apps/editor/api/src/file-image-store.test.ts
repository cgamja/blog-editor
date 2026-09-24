import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileImageStore } from "./file-image-store";

const NAME = `${"b".repeat(32)}.webp`;

describe("createFileImageStore", () => {
  it("WHEN 이름 모양의 이미지를 쓰고 읽으면 THEN 같은 바이트가 <root>/images에 있다", async () => {
    const root = await mkdtemp(join(tmpdir(), "images-"));
    const store = createFileImageStore({ root });
    const bytes = new Uint8Array([1, 2, 3]);
    expect(await store.has(NAME)).toBe(false);
    await store.put(NAME, bytes);
    expect(await store.has(NAME)).toBe(true);
    expect(await store.get(NAME)).toEqual(bytes);
    expect(await readdir(join(root, "images"))).toEqual([NAME]);
  });

  it("WHEN 경로 밖으로 나가는 이름을 쓰면 THEN 거절하고 파일을 만들지 않는다", async () => {
    const root = await mkdtemp(join(tmpdir(), "images-"));
    const store = createFileImageStore({ root });
    await expect(store.put("../escape.png", new Uint8Array([1]))).rejects.toThrow();
    expect(await store.get("../escape.png")).toBeNull();
    expect(await readdir(root)).toEqual([]);
  });
});
