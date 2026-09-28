import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { slugSchema } from "@blog-editor/content-schema";
import type { PostFile } from "@blog-editor/content-schema";
import type { AiUndoEntry, AiUndoStore } from "./ai-undo-store";
import { serialized } from "./serialized";

const ENTRY_EXTENSION = ".json";
/**
 * 파일은 손으로 고칠 수도 있다 — 모양이 틀리면 읽을 때 멈춘다. `before`의 글 모양은 글 파일과 같은 원천
 * (저장 경로가 이미 검증해 쓴 파일)이라 여기서는 객체인지만 본다(file-store가 글을 읽을 때와 같은 수준).
 */
const storedEntrySchema = z.strictObject({
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.string().min(1),
});

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

/** 로컬 개발용 ai-undo 저장소 — `<root>/workspaces/<workspaceId>/ai-undo/<slug>.json`(adr-007 · ADR-041). */
export function createFileAiUndoStore(options: { root: string; workspaceId: string }): AiUndoStore {
  const dir = join(options.root, "workspaces", options.workspaceId, "ai-undo");
  // slug가 곧 파일 이름이다 — 모양을 다시 확인해 경로 밖으로 나갈 길을 막는다(file-store와 같은 이유)
  const pathOf = (slug: string) => join(dir, `${slugSchema.parse(slug)}${ENTRY_EXTENSION}`);

  async function read(path: string): Promise<AiUndoEntry | null> {
    let text: string;
    try {
      text = await readFile(path, "utf8");
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
    const stored = storedEntrySchema.parse(JSON.parse(text));
    return { before: stored.before as PostFile | null, after: stored.after };
  }

  // 쓰기 · 지우기는 파일마다 줄을 선다(file-store와 같은 직렬화) — 두 AI 저장의 rename 순서가 뒤집혀 옛 기록이
  // 남거나, 조건부 지우기의 확인과 지우기 사이에 새 기록이 끼지 않게 한다
  return {
    get(slug) {
      return read(pathOf(slug));
    },
    put(slug, entry) {
      const path = pathOf(slug);
      return serialized(path, async () => {
        // 임시 파일 → rename: 쓰다 멈춰도 반쯤 쓴 판이 남지 않는다(file-store와 같은 방식)
        const temp = `${path}.${randomUUID()}.tmp`;
        await mkdir(dir, { recursive: true });
        await writeFile(temp, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
        await rename(temp, path);
      });
    },
    delete(slug, after) {
      const path = pathOf(slug);
      return serialized(path, async () => {
        if (after !== undefined && (await read(path))?.after !== after) return;
        try {
          await unlink(path);
        } catch (error) {
          if (!isMissing(error)) throw error;
        }
      });
    },
  };
}
