import { SCHEMA_VERSION } from "@blog-editor/content-schema";
import type { Doc, PostFile, PostMeta } from "@blog-editor/content-schema";
import { ApiError } from "../../shared/api/errors";
import { NEW_POST_KEY } from "./constants";
import { todayIsoDate } from "./editing-start";
import { localDraftOf } from "./local-draft";
import { EDITOR_MESSAGES } from "./messages";
import { missingForSave } from "./post-meta";
import { renameBeforeSave } from "./rename-before-save";
import { saveErrorKindOf } from "./save-model";
import type { DraftStore, EditingStart, LocalDraft, SaveMode, SaveStatus } from "./types";

export interface PostSaverEvents {
  onStatus: (status: SaveStatus) => void;
  /** 화면이 스스로 새 주소로 옮긴다(새 글의 첫 저장 · 주소 바꾸기) — 에디터는 그대로 둔다 */
  onAdopt: (slug: string) => void;
  /** 서버가 먼저 바뀌었다(409) */
  onConflict: () => void;
  onExpiredChange: (isExpired: boolean) => void;
  onSlugError: (message: string | null) => void;
  onPublished: () => void;
}

export interface PostSaverDeps {
  getDoc: () => Doc;
  /** 지금 입력 값 — 저장이 도는 그 순간에 읽는다 */
  readForm: () => { meta: PostMeta; slug: string };
  savePost: (slug: string, file: PostFile, revision: string | null) => Promise<string>;
  renamePost: (from: string, to: string, revision: string) => Promise<string>;
  drafts: DraftStore;
  events: PostSaverEvents;
}

export interface PostSaver {
  /**
   * 저장 한 번. 부수 효과: 서버에 보내기 전에 쓰던 글을 localDraft로 남기고, 성공하면 지운다.
   * 초안 방식(자동 저장 · ⌘S)은 발행 글 · 멈춤 · 세션 만료면 서버에 보내지 않는다.
   */
  save: (mode: SaveMode) => Promise<void>;
  /** 「저장하지 않고 계속 쓰기」 */
  pause: () => void;
  /** 「덮어쓰기」 준비 — 최신 revision 위에 저장하고, 충돌로 실패한 저장의 방식을 돌려준다 */
  prepareOverwrite: (revision: string) => SaveMode;
  isPublished: () => boolean;
  savedSlug: () => string | null;
  localKey: () => string;
  currentDraft: () => LocalDraft;
}

/**
 * 편집 화면의 서버 저장 상태(edit-screen design 2 · 3) — 주소 · revision · 발행 여부를 한 곳에서 가진다.
 * React 상태가 아니라 닫힌 변수라, 저장 줄에서 앞 저장(발행)이 끝나자마자 뒤 저장이 바뀐 값을 읽는다.
 * 저장 순서는 `createAutosave`의 줄이 정하고, 화면 상태는 `events`로 알린다.
 */
export function createPostSaver(start: EditingStart, deps: PostSaverDeps): PostSaver {
  const { events, drafts } = deps;
  let savedSlug = start.savedSlug;
  let revision = start.revision;
  let isPublished = start.isPublished;
  let isExpired = false;
  // 충돌에서 「저장하지 않고 계속 쓰기」를 고르면 자동 저장을 멈춘다 — localDraft는 계속 쓴다
  let isPaused = start.restore === "conflict";
  // 충돌로 실패한 저장의 방식 — 「덮어쓰기」가 같은 방식으로 다시 한다(발행이 초안으로 바뀌지 않게)
  let failedMode: SaveMode | null = null;

  const localKey = () => savedSlug ?? NEW_POST_KEY;
  const draftOf = (doc: Doc) => localDraftOf({ baseRevision: revision, ...deps.readForm(), doc });

  const handleFailure = (error: unknown, mode: SaveMode) => {
    const kind = saveErrorKindOf(error, savedSlug === null);
    if (kind === "expired") {
      isExpired = true;
      events.onExpiredChange(true);
    }
    if (kind === "slugTaken") events.onSlugError(EDITOR_MESSAGES.info.slugTaken);
    if (kind === "conflict") {
      failedMode = mode;
      events.onConflict();
    }
    const message = kind === "rejected" && error instanceof ApiError ? error.userMessage : null;
    events.onStatus({ kind: "failed", message });
  };

  const save = async (mode: SaveMode): Promise<void> => {
    let doc: Doc;
    try {
      doc = deps.getDoc();
    } catch {
      events.onStatus({ kind: "failed", message: null });
      return;
    }
    drafts.write(localKey(), draftOf(doc));
    // 발행 글은 자동 저장하지 않는다 — 저장이 곧 공개 글 변경이다(design 2)
    if (mode === "draft" && (isPublished || isPaused || isExpired)) return;

    const { meta, slug } = deps.readForm();
    const missing = missingForSave(meta, slug);
    if (missing.length > 0) {
      events.onStatus({ kind: "incomplete", missing });
      return;
    }
    const wasPublished = isPublished;
    const willPublish = mode === "publish" || wasPublished;
    const file: PostFile = {
      schemaVersion: SCHEMA_VERSION,
      meta: { ...meta, draft: !willPublish, ...(wasPublished ? { updated: todayIsoDate() } : {}) },
      doc,
    };
    events.onStatus({ kind: "saving" });
    try {
      if (savedSlug !== null && revision !== null && savedSlug !== slug) {
        const moved = await renameBeforeSave({
          from: savedSlug,
          to: slug,
          revision,
          draft: draftOf(doc),
          renamePost: deps.renamePost,
          drafts,
        });
        if (moved.kind === "rejected") {
          events.onSlugError(moved.message);
          events.onStatus({ kind: "failed", message: null });
          return;
        }
        savedSlug = slug;
        revision = moved.revision;
        events.onAdopt(slug);
      }
      const wasNew = savedSlug === null;
      const next = await deps.savePost(slug, file, revision);
      drafts.clear(localKey());
      savedSlug = slug;
      revision = next;
      if (wasNew) events.onAdopt(slug);
      isPaused = false;
      failedMode = null;
      events.onSlugError(null);
      if (isExpired) {
        isExpired = false;
        events.onExpiredChange(false);
      }
      if (willPublish && !wasPublished) {
        isPublished = true;
        events.onPublished();
        events.onStatus({ kind: "published" });
      } else {
        events.onStatus({ kind: "saved", at: new Date(), isPublished: willPublish });
      }
    } catch (error) {
      handleFailure(error, mode);
    }
  };

  return {
    save,
    pause: () => {
      isPaused = true;
      events.onStatus({ kind: "failed", message: null });
    },
    prepareOverwrite: (latest) => {
      revision = latest;
      isPaused = false;
      return failedMode ?? (isPublished ? "publish" : "draft");
    },
    isPublished: () => isPublished,
    savedSlug: () => savedSlug,
    localKey,
    currentDraft: () => draftOf(deps.getDoc()),
  };
}
