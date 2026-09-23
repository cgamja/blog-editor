import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixtures } from "@blog-editor/content-schema";
import { createFilePostStore } from "./file-store";
import { describePostStoreContract } from "./post-store.contract";

const WORKSPACE_ID = "default";
const roots: string[] = [];

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blog-editor-store-"));
  roots.push(root);
  return root;
}

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

describePostStoreContract("FilePostStore", async () =>
  createFilePostStore({ root: await tempRoot(), workspaceId: WORKSPACE_ID }),
);

describe("FilePostStore — 워크스페이스 경로", () => {
  it("WHEN 쓴 뒤 같은 루트로 새 저장소를 열면 THEN 같은 file · revision이고 파일이 워크스페이스 경로에 있다", async () => {
    const root = await tempRoot();
    const { revision } = await createFilePostStore({ root, workspaceId: WORKSPACE_ID }).put(
      "beta-open",
      fixtures.minimal,
      null,
    );

    const reopened = createFilePostStore({ root, workspaceId: WORKSPACE_ID });

    expect(await reopened.get("beta-open")).toEqual({ file: fixtures.minimal, revision });
    expect(existsSync(join(root, "workspaces", WORKSPACE_ID, "posts", "beta-open.json"))).toBe(
      true,
    );
  });
});
