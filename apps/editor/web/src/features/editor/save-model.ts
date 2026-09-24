import { HTTP_BAD_REQUEST } from "../../shared/api/constants";
import { ApiError, ConflictError, UnauthorizedError } from "../../shared/api/errors";
import { RENAME_STALE_REASON } from "./constants";
import { EDITOR_MESSAGES } from "./messages";
import type { RenameErrorKind, SaveErrorKind, SaveStatus } from "./types";

const HOURS_PER_HALF_DAY = 12;

/** 아직 서버에 없는 글은 `If-None-Match: *`, 불러온 글은 받은 revision으로 `If-Match`(posts-api) */
export function saveHeadersOf(revision: string | null): Record<string, string> {
  return revision === null ? { "If-None-Match": "*" } : { "If-Match": `"${revision}"` };
}

/**
 * 저장 실패를 화면이 할 일로 나눈다(edit-screen design 2). 새 글의 409는 그 주소에 글이 이미 있다는 뜻이고
 * (`If-None-Match: *`), 불러온 글의 409는 다른 곳에서 먼저 고쳤다는 뜻이다.
 */
export function saveErrorKindOf(error: unknown, isNew: boolean): SaveErrorKind {
  if (error instanceof UnauthorizedError) return "expired";
  if (error instanceof ConflictError) return isNew ? "slugTaken" : "conflict";
  if (error instanceof ApiError && error.status === HTTP_BAD_REQUEST) return "rejected";
  return "failed";
}

// 한글 음절의 받침 = (코드 - 0xAC00) % 28, 0이면 받침 없음(Unicode 한글 음절 조합)
const HANGUL_FIRST = 0xac00;
const FINAL_COUNT = 28;

/** 목적격 조사 — 받침이 있으면 "을", 없으면 "를"(「제목 · 카테고리를」) */
function objectParticleOf(word: string): string {
  const code = word.codePointAt(word.length - 1) ?? HANGUL_FIRST;
  return (code - HANGUL_FIRST) % FINAL_COUNT === 0 ? "를" : "을";
}

/**
 * 주소 바꾸기 실패 — 409는 본문 `reason`으로 나눈다(post-rename-api). 다른 곳에서 먼저 고쳤으면(stale) 충돌
 * 대화상자, 발행 글 · 이미 있는 주소면 주소 칸 문장. 그 밖은 저장 실패와 같다.
 */
export function renameErrorKindOf(error: unknown): RenameErrorKind {
  if (error instanceof ConflictError) {
    return reasonOf(error.body) === RENAME_STALE_REASON ? "conflict" : "slugRejected";
  }
  return saveErrorKindOf(error, false);
}

/** 409 본문의 `reason`(post-rename-api) — 없거나 문자열이 아니면 null */
function reasonOf(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("reason" in body)) return null;
  const { reason } = body as { reason: unknown };
  return typeof reason === "string" ? reason : null;
}

/** "오후 3시 42분" — 디자인 68:2 머리줄 표기(Intl의 "오후 3:42"와 다르다) */
function clockText(at: Date): string {
  const hours = at.getHours();
  const period = hours < HOURS_PER_HALF_DAY ? "오전" : "오후";
  const hour = hours % HOURS_PER_HALF_DAY === 0 ? HOURS_PER_HALF_DAY : hours % HOURS_PER_HALF_DAY;
  return `${period} ${hour}시 ${at.getMinutes()}분`;
}

/** 머리줄 저장 문구(디자인 결정 4-A) — 늘 같은 자리에서 조용히 바뀐다 */
export function saveStatusText(status: SaveStatus): string {
  const { status: text, fieldNames } = EDITOR_MESSAGES;
  switch (status.kind) {
    case "idle":
      return "";
    case "incomplete": {
      const names = status.missing.map((field) => fieldNames[field]).join(" · ");
      return `${names}${objectParticleOf(names)} ${text.incomplete}`;
    }
    case "saving":
      return text.saving;
    case "saved":
      return `${status.isPublished ? text.savedPublished : text.savedDraft}, ${clockText(status.at)}`;
    case "published":
      return text.published;
    case "failed":
      return status.message ?? text.failed;
  }
}
