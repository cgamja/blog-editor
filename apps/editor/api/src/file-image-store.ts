import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isImageName } from "./image-store";
import type { ImageStore } from "./image-store";

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

/**
 * 로컬 개발용 이미지 저장소(ADR-021) — `<root>/images/<해시>.<확장자>`. 이름 모양을 다시 확인해 경로 밖으로
 * 나갈 길을 막는다(라우트가 이미 거르지만 저장소도 믿지 않는다 — file-store와 같은 관례).
 */
export function createFileImageStore(options: { root: string }): ImageStore {
  const dir = join(options.root, "images");
  const pathOf = (name: string): string | null => (isImageName(name) ? join(dir, name) : null);

  return {
    async has(name) {
      const path = pathOf(name);
      if (path === null) return false;
      try {
        await access(path);
        return true;
      } catch (error) {
        if (isMissing(error)) return false;
        throw error;
      }
    },
    async put(name, bytes) {
      const path = pathOf(name);
      if (path === null) throw new Error(`이미지 이름 모양이 아니다 — ${name}`);
      // 임시 파일 → rename: 쓰다 멈춰도 반쯤 쓴 이미지가 남지 않는다. 같은 이름은 같은 내용이라 겹쳐 써도 된다
      const temp = `${path}.${randomUUID()}.tmp`;
      await mkdir(dir, { recursive: true });
      try {
        await writeFile(temp, bytes);
        await rename(temp, path);
      } catch (error) {
        await rm(temp, { force: true });
        throw error;
      }
    },
    async get(name) {
      const path = pathOf(name);
      if (path === null) return null;
      try {
        return new Uint8Array(await readFile(path));
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },
  };
}
