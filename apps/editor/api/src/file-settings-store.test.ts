import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileSettingsStore } from "./file-settings-store";

const WORKSPACE_ID = "default";
const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

describe("workspace-settings-api — 파일 설정 저장소", () => {
  it("WHEN 파일 저장소에 가이드를 쓰고 같은 루트로 새 저장소를 열면 THEN 같은 가이드를 읽고 파일이 워크스페이스 경로에 있다", async () => {
    const root = await mkdtemp(join(tmpdir(), "blog-editor-settings-"));
    roots.push(root);

    await createFileSettingsStore({ root, workspaceId: WORKSPACE_ID }).put({ guide: "가이드" });
    const reopened = createFileSettingsStore({ root, workspaceId: WORKSPACE_ID });

    expect(await reopened.get()).toEqual({ guide: "가이드" });
    expect(existsSync(join(root, "workspaces", WORKSPACE_ID, "settings.json"))).toBe(true);
  });
});
