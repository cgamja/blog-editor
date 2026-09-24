import type { Doc, PostMeta } from "@blog-editor/content-schema";
import type { LoadedPost } from "./api";
import { restoreDecisionOf } from "./local-draft";
import type { EditingStart, LocalDraft } from "./types";

const EMPTY_DOC: Doc = { type: "doc", content: [{ type: "paragraph" }] };

/** 오늘 날짜(브라우저 시간대) `YYYY-MM-DD` — 글 메타 `date` 모양 */
export function todayIsoDate(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function blankMeta(): PostMeta {
  return {
    title: "",
    description: "",
    date: todayIsoDate(),
    category: "",
    draft: true,
    source: "editor",
  };
}

/**
 * 편집을 시작할 상태 — 서버 글과 브라우저에 남은 글(localDraft)을 합친다(edit-screen design 3).
 * 새 글은 남은 글이 있으면 이어 쓴다. 불러온 글은 같은 revision 위에서 쓰던 글이면 되살리고, 그사이 서버가
 * 바뀌었으면 쓰던 글을 보여 주며 충돌 대화상자를 연다.
 */
export function editingStartOf(
  loaded: LoadedPost | null,
  slug: string | null,
  local: LocalDraft | null,
): EditingStart {
  if (loaded === null || slug === null) {
    return {
      meta: local?.meta ?? blankMeta(),
      doc: local?.doc ?? EMPTY_DOC,
      slug: local?.slug ?? "",
      savedSlug: null,
      revision: null,
      isPublished: false,
      restore: local === null ? "none" : "restore",
    };
  }
  const restore = restoreDecisionOf(local, loaded.revision);
  const source = restore === "none" || local === null ? loaded.file : local;
  const isPublished = loaded.file.meta.draft === false;
  return {
    // 발행 여부는 서버가 진실이다 — 남은 글의 draft 값은 쓰기 시작한 때의 것이다
    meta: { ...source.meta, draft: !isPublished },
    doc: source.doc,
    slug,
    savedSlug: slug,
    revision: loaded.revision,
    isPublished,
    restore,
  };
}
