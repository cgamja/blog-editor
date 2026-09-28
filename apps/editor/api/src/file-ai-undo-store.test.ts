import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixtures } from "@blog-editor/content-schema";
import { describeAiUndoStoreContract } from "./ai-undo-store.contract";
import { createFileAiUndoStore } from "./file-ai-undo-store";

const WORKSPACE_ID = "default";
const roots: string[] = [];

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blog-editor-ai-undo-"));
  roots.push(root);
  return root;
}

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

describeAiUndoStoreContract("FileAiUndoStore", async () =>
  createFileAiUndoStore({ root: await tempRoot(), workspaceId: WORKSPACE_ID }),
);

describe("FileAiUndoStore — 워크스페이스 경로", () => {
  it("WHEN 남긴 판을 쓴 뒤 같은 루트로 새 저장소를 열면 THEN 같은 판을 읽고 파일이 workspaces/<id>/ai-undo/<slug>.json에 있다", async () => {
    const root = await tempRoot();
    const entry = { before: fixtures.minimal, after: "revision-1" };
    await createFileAiUndoStore({ root, workspaceId: WORKSPACE_ID }).put("beta-open", entry);

    const reopened = createFileAiUndoStore({ root, workspaceId: WORKSPACE_ID });

    expect(await reopened.get("beta-open")).toEqual(entry);
    expect(existsSync(join(root, "workspaces", WORKSPACE_ID, "ai-undo", "beta-open.json"))).toBe(
      true,
    );
  });
});
