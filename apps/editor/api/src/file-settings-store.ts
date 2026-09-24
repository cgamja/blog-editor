import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { EMPTY_SETTINGS } from "./settings-store";
import type { SettingsStore } from "./settings-store";

const SETTINGS_FILE = "settings.json";
/** 파일은 손으로 고칠 수도 있다 — 모르는 키 · 틀린 타입은 읽을 때 멈추고, 빠진 키는 기본값 */
const storedSettingsSchema = z.strictObject({ guide: z.string() }).partial();

/** 로컬 개발용 설정 저장소 — `<root>/workspaces/<workspaceId>/settings.json`(adr-007). */
export function createFileSettingsStore(options: {
  root: string;
  workspaceId: string;
}): SettingsStore {
  const dir = join(options.root, "workspaces", options.workspaceId);
  const path = join(dir, SETTINGS_FILE);

  return {
    async get() {
      let text: string;
      try {
        text = await readFile(path, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return { ...EMPTY_SETTINGS };
        throw error;
      }
      // 빠진 키는 기본값 — 뒤에 설정 항목이 늘어도 옛 파일을 그대로 읽는다
      const stored = storedSettingsSchema.parse(JSON.parse(text));
      return { guide: stored.guide ?? EMPTY_SETTINGS.guide };
    },
    async put(settings) {
      // 임시 파일 → rename: 쓰다 멈춰도 반쯤 쓴 설정이 남지 않는다(file-store와 같은 방식)
      const temp = `${path}.${randomUUID()}.tmp`;
      await mkdir(dir, { recursive: true });
      await writeFile(temp, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
      await rename(temp, path);
    },
  };
}
