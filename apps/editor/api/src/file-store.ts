import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { slugSchema } from "@blog-editor/content-schema";
import type { PostFile } from "@blog-editor/content-schema";
import { revisionOf, serialize } from "./revision";
import { ConflictError } from "./store";
import type { PostStore } from "./store";

const POST_EXTENSION = ".json";

/**
 * 경로별 직렬화 — 확인(읽기)과 쓰기 사이의 await 틈에 다른 put이 끼지 못하게 한다.
 * 같은 프로세스 안에서만 원자적이다(로컬 개발은 프로세스 하나, 운영 원자성은 S3 조건부 쓰기 — adr-014).
 * 모듈 전역이라 같은 루트를 연 저장소 인스턴스끼리도 줄을 선다.
 */
const queues = new Map<string, Promise<unknown>>();

function serialized<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const result = previous.then(task, task);
  queues.set(
    key,
    result.catch(() => undefined),
  );
  return result;
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

/** 로컬 개발용 저장소(D12) — `<root>/workspaces/<workspaceId>/posts/<slug>.json`. */
export function createFilePostStore(options: { root: string; workspaceId: string }): PostStore {
  const dir = join(options.root, "workspaces", options.workspaceId, "posts");
  // slug가 곧 파일 이름이다 — 모양을 다시 확인해 경로 밖으로 나갈 길을 막는다(API가 이미 거르지만 저장소도 믿지 않는다)
  const pathOf = (slug: string) => join(dir, `${slugSchema.parse(slug)}${POST_EXTENSION}`);

  return {
    async list() {
      let names: string[];
      try {
        names = await readdir(dir);
      } catch (error) {
        if (isMissing(error)) return [];
        throw error;
      }
      const slugs = names
        .filter((name) => name.endsWith(POST_EXTENSION))
        .map((name) => name.slice(0, -POST_EXTENSION.length))
        // 손으로 넣은 `Hello_World.json` 하나가 목록 전체를 깨지 않게, slug 모양이 아닌 파일은 글이 아니다
        .filter((slug) => slugSchema.safeParse(slug).success);
      return Promise.all(
        slugs.map(async (slug) => ({
          slug,
          meta: (JSON.parse(await readFile(pathOf(slug), "utf8")) as PostFile).meta,
        })),
      );
    },
    async get(slug) {
      const text = await readText(pathOf(slug));
      if (text === null) return null;
      return { file: JSON.parse(text) as PostFile, revision: revisionOf(text) };
    },
    put(slug, file, revision) {
      const path = pathOf(slug);
      return serialized(path, async () => {
        const currentText = await readText(path);
        const current = currentText === null ? null : revisionOf(currentText);
        if (current !== revision) throw new ConflictError(slug);
        const text = serialize(file);
        // 임시 파일 → rename: 쓰다 멈춰도 반쯤 쓴 글이 남지 않는다
        const temp = `${path}.${randomUUID()}.tmp`;
        await mkdir(dir, { recursive: true });
        await writeFile(temp, text, "utf8");
        await rename(temp, path);
        return { revision: revisionOf(text) };
      });
    },
    async delete(slug, revision) {
      throw new Error(`미구현: ${slug} ${revision}`);
    },
  };
}
