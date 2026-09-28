import { SCHEMA_VERSION } from "@blog-editor/content-schema";
import type { Doc, PostFile, PostMeta } from "@blog-editor/content-schema";
import { ApiError } from "../../shared/api/errors";
import { NEW_POST_KEY } from "./constants";
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
   * 자동 저장 시계가 부른 저장(`isTimer`)은 붙잡아 둔 동안(`hold`)에도 보내지 않는다 — localDraft는 남긴다.
   */
  save: (mode: SaveMode, isTimer?: boolean) => Promise<void>;
  /**
   * 자동 저장을 붙잡거나 푼다 — 다른 곳에서 바뀐 판을 알리는 띠가 떠 있는 동안 옛 revision으로 보내 충돌이 나지
   * 않게(live-reflect). ⌘S · 발행처럼 사람이 부른 저장은 그대로 가서 충돌 흐름을 탄다
   */
  hold: (isHeld: boolean) => void;
  /** 「저장하지 않고 계속 쓰기」 */
  pause: () => void;
  /** 「덮어쓰기」 준비 — 최신 revision 위에 저장하고, 충돌로 실패한 저장의 방식을 돌려준다 */
  prepareOverwrite: (revision: string) => SaveMode;
  isPublished: () => boolean;
  /** 「저장하지 않고 계속 쓰기」로 자동 저장을 멈췄다 */
  isPaused: () => boolean;
  /** 내가 가진 서버 판 — 불러온 판이나 마지막 저장이 돌려준 revision */
  revision: () => string | null;
  /**
   * 서버와 맞춘 횟수 표식 — 보내기 시작 · 끝 · revision을 바꿀 때마다 오른다.
   * 서버 판을 읽는 동안 표식이 바뀌었으면 그 판은 내 저장과 앞뒤가 섞였을 수 있다(live-reflect)
   */
  syncMark: () => number;
  /** 서버에 보내는 중이다(저장 · 주소 바꾸기) */
  isSending: () => boolean;
  /** 서버와 맞춘 뒤(불러오기 · 저장 · 바꿔 끼우기) 본문이나 글 정보를 고쳤나. 문서를 읽지 못하면 true */
  hasUnsavedChanges: () => boolean;
  /** 지금 입력 값과 문서를 서버와 맞춘 것으로 친다 — 서버 판 그대로 연 편집 화면의 처음 */
  markSynced: () => void;
  /**
   * 다른 곳에서 바뀐 서버 판을 받아들였다(바꿔 끼우기) — 그 revision 위에서 이어 쓴다. 부수 효과: 쓰던 글
   * (localDraft)을 버리고, 멈춤 · 충돌로 실패한 저장을 풀고, 발행 여부를 받은 판(`meta.draft`)으로 맞춘 뒤
   * 머리줄을 비운다. `form`은 바꿔 끼운 글 정보 — 화면 상태는 다음 렌더에야 바뀌므로 받은 값으로 맞춘다
   */
  adoptLatestAndDropDraft: (latest: string, form: { meta: PostMeta; slug: string }) => void;
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
  // 보내기 시작 · 끝마다 1, revision을 바꿀 때 2씩 오른다 — 홀수면 보내는 중이다(이 규칙은 여기 안에만)
  let syncMark = 0;
  let isHeld = false;
  // 서버와 맞춘 입력 값 · 문서의 글자 — null이면 맞춘 적이 없다(되살린 글 · 새 글)
  let synced: string | null = null;

  const localKey = () => savedSlug ?? NEW_POST_KEY;
  const snapshotOf = (form: { meta: PostMeta; slug: string }, doc: Doc) =>
    JSON.stringify({ meta: form.meta, slug: form.slug, doc });
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

  const save = async (mode: SaveMode, isTimer = false): Promise<void> => {
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
    if (mode === "draft" && isTimer && isHeld) return;

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
      // 수정일은 서버가 정한다(adr-030) — 발행 글 내용이 바뀌었을 때만 블로그 시간대의 오늘로 올린다
      meta: { ...meta, draft: !willPublish },
      doc,
    };
    events.onStatus({ kind: "saving" });
    const sent = snapshotOf({ meta, slug }, doc);
    syncMark += 1;
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
      synced = sent;
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
    } finally {
      syncMark += 1;
    }
  };

  return {
    save,
    hold: (next) => {
      isHeld = next;
    },
    pause: () => {
      isPaused = true;
      events.onStatus({ kind: "failed", message: null });
    },
    prepareOverwrite: (latest) => {
      revision = latest;
      syncMark += 2;
      isPaused = false;
      return failedMode ?? (isPublished ? "publish" : "draft");
    },
    isPublished: () => isPublished,
    isPaused: () => isPaused,
    revision: () => revision,
    syncMark: () => syncMark,
    isSending: () => syncMark % 2 === 1,
    hasUnsavedChanges: () => {
      try {
        return synced !== snapshotOf(deps.readForm(), deps.getDoc());
      } catch {
        return true;
      }
    },
    markSynced: () => {
      try {
        synced = snapshotOf(deps.readForm(), deps.getDoc());
      } catch {
        synced = null;
      }
    },
    adoptLatestAndDropDraft: (latest, form) => {
      revision = latest;
      syncMark += 2;
      drafts.clear(localKey());
      isPaused = false;
      failedMode = null;
      isPublished = form.meta.draft === false;
      events.onStatus({ kind: "idle" });
      try {
        synced = snapshotOf(form, deps.getDoc());
      } catch {
        synced = null;
      }
    },
    savedSlug: () => savedSlug,
    localKey,
    currentDraft: () => draftOf(deps.getDoc()),
  };
}
