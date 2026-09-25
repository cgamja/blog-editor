import type { PostFile } from "@blog-editor/content-schema";

/** 둘 다 정규형이라(저장된 판 · 저장 직전 normalize) 문자열로 비교해도 키 순서가 같다 */
function sameContent(a: PostFile, b: PostFile): boolean {
  return (
    a.meta.title === b.meta.title &&
    a.meta.description === b.meta.description &&
    JSON.stringify(a.doc) === JSON.stringify(b.doc)
  );
}

function withUpdated(file: PostFile, updated: string | undefined): PostFile {
  const meta = { ...file.meta };
  delete meta.updated;
  return { ...file, meta: updated === undefined ? meta : { ...meta, updated } };
}

/**
 * 발행 글의 수정일은 서버가 정한다(adr-030) — 사이트가 이 값을 `dateModified`로 알린다.
 * 발행 글끼리면 내용이 바뀌었을 때 오늘, 같으면 **저장된** 값을 지킨다(폼에 남은 옛 값이 되돌리지 못하게).
 * 새 글 · 초안 저장 · 처음 발행은 보낸 그대로다.
 * @param saved `If-Match`가 가리키는 지금 저장된 판(판이 다르면 null — 저장은 어차피 409)
 */
export function withPublishedUpdate(
  saved: PostFile | null,
  next: PostFile,
  today: string,
): PostFile {
  const bothPublished = saved?.meta.draft === false && next.meta.draft === false;
  if (saved === null || !bothPublished) return next;
  return withUpdated(next, sameContent(saved, next) ? saved.meta.updated : today);
}

/** 수정일 판단에 저장된 판이 필요한 PUT인가 — 새 글 · 초안 저장은 읽지 않는다 */
export function needsSavedForUpdate(expected: string | null, next: PostFile): boolean {
  return expected !== null && next.meta.draft === false;
}
