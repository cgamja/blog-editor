/**
 * 백업 · 복구의 Supabase API 쪽(backup-restore · ADR-044). DB 행은 pg_dump가 맡고, 이 스크립트는
 * 사진 버킷 객체와 대조용 목록(manifest)을 맡는다. 워크플로(`.github/workflows/backup.yml` · `restore-verify.yml`)가 부른다.
 *
 *   node apps/editor/api/scripts/backup-storage.ts snapshot <dir>  원본의 사진을 <dir>/images에, 목록을 <dir>/manifest.json에
 *   node apps/editor/api/scripts/backup-storage.ts restore <dir>   <dir>/images를 대상 버킷에 올린다
 *   node apps/editor/api/scripts/backup-storage.ts verify <dir>    대상의 글 revision · 사진 이름이 manifest와 같은지 대조
 *
 * env — snapshot은 SOURCE_*, restore · verify는 TARGET_*: `<접두>_SUPABASE_URL` · `<접두>_SECRET_KEY`(sb_secret_…)
 *
 * node가 타입만 벗겨 바로 돌리므로 src의 모듈(확장자 없는 상대 import)을 가져오지 않는다 — 그래서 버킷 이름 · 클라이언트
 * 옵션을 여기 다시 적는다. `images`는 마이그레이션 SQL · src/supabase/image-store.ts와 같아야 한다.
 * 레포가 공개라 Actions 로그도 공개다 — 글 slug · revision 같은 내용은 찍지 않고 개수만 찍는다.
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "images";
const PAGE_SIZE = 1000;
const MANIFEST = "manifest.json";
const IMAGES_DIR = "images";

interface Manifest {
  /** `<workspace_id>/<slug>` → revision */
  posts: Record<string, string>;
  images: string[];
}

function clientFrom(prefix: "SOURCE" | "TARGET"): SupabaseClient {
  const url = process.env[`${prefix}_SUPABASE_URL`];
  const key = process.env[`${prefix}_SECRET_KEY`];
  if (!url || !key) throw new Error(`${prefix}_SUPABASE_URL · ${prefix}_SECRET_KEY가 필요하다`);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function listImages(client: SupabaseClient): Promise<string[]> {
  const names: string[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client.storage
      .from(BUCKET)
      .list("", { limit: PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    names.push(...data.map((object) => object.name));
    if (data.length < PAGE_SIZE) return names.sort();
  }
}

async function listRevisions(client: SupabaseClient): Promise<Record<string, string>> {
  const revisions: Record<string, string> = {};
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from("posts")
      .select("workspace_id, slug, revision")
      .order("workspace_id")
      .order("slug")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    for (const row of data) revisions[`${row.workspace_id}/${row.slug}`] = row.revision;
    if (data.length < PAGE_SIZE) return revisions;
  }
}

async function snapshot(dir: string): Promise<void> {
  const client = clientFrom("SOURCE");
  const images = await listImages(client);
  await mkdir(join(dir, IMAGES_DIR), { recursive: true });
  for (const name of images) {
    const { data, error } = await client.storage.from(BUCKET).download(name);
    if (error) throw error;
    await writeFile(join(dir, IMAGES_DIR, name), new Uint8Array(await data.arrayBuffer()));
  }
  const manifest: Manifest = { posts: await listRevisions(client), images };
  await writeFile(join(dir, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`snapshot: 글 ${Object.keys(manifest.posts).length} · 사진 ${images.length}`);
}

async function restore(dir: string): Promise<void> {
  const client = clientFrom("TARGET");
  const names = await readdir(join(dir, IMAGES_DIR));
  for (const name of names) {
    const bytes = await readFile(join(dir, IMAGES_DIR, name));
    // 이름이 내용 해시라 같은 이름은 같은 내용이다(ADR-021) — 덮어써도 결과가 같다
    const { error } = await client.storage.from(BUCKET).upload(name, bytes, { upsert: true });
    if (error) throw error;
  }
  console.log(`restore: 사진 ${names.length}`);
}

/** 빠진 수 · 더 있는 수만 센다 — 어떤 글인지(초안 slug)는 공개 로그에 남기지 않는다 */
function difference(label: string, expected: string[], actual: string[]): string | null {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((item) => !actualSet.has(item)).length;
  const extra = actual.filter((item) => !expectedSet.has(item)).length;
  return missing === 0 && extra === 0 ? null : `${label} 빠짐 ${missing} · 더 있음 ${extra}`;
}

async function verify(dir: string): Promise<void> {
  const client = clientFrom("TARGET");
  const manifest = JSON.parse(await readFile(join(dir, MANIFEST), "utf8")) as Manifest;
  const posts = await listRevisions(client);
  const pairs = (record: Record<string, string>) =>
    Object.entries(record).map(([key, revision]) => `${key}@${revision}`);
  const problems = [
    difference("글", pairs(manifest.posts), pairs(posts)),
    difference("사진", manifest.images, await listImages(client)),
  ].filter((problem) => problem !== null);
  if (problems.length > 0) {
    throw new Error(`복구 결과가 백업과 다르다 — ${problems.join(" · ")}`);
  }
  console.log(`verify: 같다 — 글 ${Object.keys(posts).length} · 사진 ${manifest.images.length}`);
}

const COMMANDS: Record<string, (dir: string) => Promise<void>> = { snapshot, restore, verify };
const [command, dir] = process.argv.slice(2);
const run = command === undefined ? undefined : COMMANDS[command];
if (run === undefined || dir === undefined) {
  throw new Error("사용법: backup-storage.ts <snapshot|restore|verify> <dir>");
}
await run(dir);
