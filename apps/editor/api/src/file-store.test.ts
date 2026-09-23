import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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

describe("FilePostStore — slug가 아닌 파일 (리뷰 재현)", () => {
  it("WHEN posts 폴더에 slug 모양이 아닌 .json 파일이 있으면 THEN 목록은 그 파일만 건너뛴다", async () => {
    const root = await tempRoot();
    const store = createFilePostStore({ root, workspaceId: WORKSPACE_ID });
    await store.put("beta-open", fixtures.minimal, null);
    await writeFile(
      join(root, "workspaces", WORKSPACE_ID, "posts", "Hello_World.json"),
      JSON.stringify(fixtures.minimal),
    );

    expect((await store.list()).map((summary) => summary.slug)).toEqual(["beta-open"]);
  });
});

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
