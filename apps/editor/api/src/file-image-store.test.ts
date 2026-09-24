import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileImageStore } from "./file-image-store";

const NAME = `${"b".repeat(32)}.webp`;
const WEBP = "image/webp";

describe("createFileImageStore", () => {
  it("WHEN 이름 모양의 이미지를 쓰고 읽으면 THEN 같은 바이트가 <root>/images에 있다", async () => {
    const root = await mkdtemp(join(tmpdir(), "images-"));
    const store = createFileImageStore({ root });
    const bytes = new Uint8Array([1, 2, 3]);
    expect(await store.has(NAME)).toBe(false);
    await store.put(NAME, bytes, WEBP);
    expect(await store.has(NAME)).toBe(true);
    expect(await store.get(NAME)).toEqual(bytes);
    expect(await readdir(join(root, "images"))).toEqual([NAME]);
  });

  it("WHEN 경로 밖으로 나가는 이름을 쓰면 THEN 거절하고 파일을 만들지 않는다", async () => {
    const root = await mkdtemp(join(tmpdir(), "images-"));
    const store = createFileImageStore({ root });
    await expect(store.put("../escape.png", new Uint8Array([1]), "image/png")).rejects.toThrow();
    expect(await store.get("../escape.png")).toBeNull();
    expect(await readdir(root)).toEqual([]);
  });

  it("WHEN rename이 실패하면 THEN 오류를 던지고 .tmp 파일이 남지 않는다", async () => {
    const root = await mkdtemp(join(tmpdir(), "images-"));
    const store = createFileImageStore({ root });
    // 같은 이름의 비어 있지 않은 디렉터리가 있으면 파일을 그 자리로 rename할 수 없다
    await mkdir(join(root, "images", NAME), { recursive: true });
    await writeFile(join(root, "images", NAME, "keep"), "x");
    await expect(store.put(NAME, new Uint8Array([1]), WEBP)).rejects.toThrow();
    expect(await readdir(join(root, "images"))).toEqual([NAME]);
  });
});
