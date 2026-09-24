import { fixtures } from "@blog-editor/content-schema";
import type { PostFile } from "@blog-editor/content-schema";
import { createPostSaver } from "./post-saver";
import type { DraftStore, EditingStart, LocalDraft } from "./types";

const loadedStart = (isPublished: boolean): EditingStart => ({
  meta: { ...fixtures.minimal.meta, draft: !isPublished },
  doc: fixtures.minimal.doc,
  slug: "beta-open",
  savedSlug: "beta-open",
  revision: "r1",
  isPublished,
  restore: "none",
});

function setup(start: EditingStart, options: { slug?: string } = {}) {
  const puts: Array<{ slug: string; file: PostFile; revision: string | null }> = [];
  const pending: Array<(revision: string) => void> = [];
  let failNextPut = false;
  const drafts = new Map<string, LocalDraft>();
  const store: DraftStore = {
    write: (key, draft) => drafts.set(key, draft),
    clear: (key) => drafts.delete(key),
  };
  const saver = createPostSaver(start, {
    getDoc: () => fixtures.minimal.doc,
    readForm: () => ({ meta: start.meta, slug: options.slug ?? start.slug }),
    savePost: (slug, file, revision) => {
      puts.push({ slug, file, revision });
      if (failNextPut) {
        failNextPut = false;
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return new Promise<string>((resolve) => pending.push(resolve));
    },
    renamePost: () => Promise.resolve("r-moved"),
    drafts: store,
    events: {
      onStatus: () => undefined,
      onAdopt: () => undefined,
      onConflict: () => undefined,
      onExpiredChange: () => undefined,
      onSlugError: () => undefined,
      onPublished: () => undefined,
    },
  });
  return {
    saver,
    puts,
    drafts,
    finishPut: async (revision: string) => {
      pending.shift()?.(revision);
      await Promise.resolve();
    },
    failNext: () => {
      failNextPut = true;
    },
  };
}

describe("web-post-save — 발행 뒤에 줄 선 저장", () => {
  it("WHEN 발행 저장이 끝난 뒤 줄 서 있던 초안 저장이 돌면 THEN draft:true로 PUT하지 않는다", async () => {
    const { saver, puts, finishPut } = setup(loadedStart(false));

    const publishing = saver.save("publish");
    await Promise.resolve();
    await finishPut("r2");
    await publishing;
    await saver.save("draft");

    expect(puts.map(({ file }) => file.meta.draft)).not.toContain(true);
    expect(saver.isPublished()).toBe(true);
  });
});

describe("web-post-save — 주소를 바꾼 뒤 저장이 실패해도 쓰던 글이 남는다", () => {
  it("WHEN 주소 바꾸기가 된 뒤 PUT이 실패하면 THEN localDraft가 새 주소 키에 있고 옛 키는 비었다", async () => {
    const { saver, drafts, failNext } = setup(loadedStart(false), { slug: "new-home" });
    failNext();

    await saver.save("draft");

    expect(drafts.has("new-home")).toBe(true);
    expect(drafts.get("new-home")?.baseRevision).toBe("r-moved");
    expect(drafts.has("beta-open")).toBe(false);
  });
});
