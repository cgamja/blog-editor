import { ApiError } from "../../shared/api/errors";
import { EDITOR_MESSAGES } from "./messages";
import { renameErrorKindOf } from "./save-model";
import type { DraftStore, LocalDraft } from "./types";

export interface RenameBeforeSaveInput {
  from: string;
  to: string;
  revision: string;
  /** 지금 쓰던 글 — 옮긴 뒤 새 주소 키에 남긴다 */
  draft: LocalDraft;
  renamePost: (from: string, to: string, revision: string) => Promise<string>;
  drafts: DraftStore;
}

export type RenameOutcome =
  { kind: "moved"; revision: string } | { kind: "rejected"; message: string };

/**
 * 저장 전에 초안 주소를 옮긴다(post-rename-api). 옮기면 쓰던 글을 새 주소 키에 먼저 남기고 옛 키를 지운다 —
 * 뒤 PUT이 실패해도 다시 열 주소(새 주소)에서 쓰던 글이 되살아난다. 발행 글 · 이미 있는 주소면 주소 칸 문장을
 * 돌려주고, 그 밖의 실패(stale 409 · 401 · 네트워크)는 저장 실패로 던진다.
 */
export async function renameBeforeSave({
  from,
  to,
  revision,
  draft,
  renamePost,
  drafts,
}: RenameBeforeSaveInput): Promise<RenameOutcome> {
  try {
    const moved = await renamePost(from, to, revision);
    drafts.write(to, { ...draft, slug: to, baseRevision: moved });
    drafts.clear(from);
    return { kind: "moved", revision: moved };
  } catch (error) {
    if (renameErrorKindOf(error) !== "slugRejected") throw error;
    const message = error instanceof ApiError ? error.userMessage : null;
    return { kind: "rejected", message: message ?? EDITOR_MESSAGES.info.slugTaken };
  }
}
