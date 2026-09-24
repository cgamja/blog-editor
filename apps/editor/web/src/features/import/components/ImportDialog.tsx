import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import type { FormEvent } from "react";
import { generatePath, useNavigate } from "react-router";
import { ApiError, ConflictError } from "../../../shared/api/errors";
import { ROUTES } from "../../../shared/routes/constants";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { createDraft } from "../api";
import { BLOG_DATE_FORMAT } from "../constants";
import { useImportPreview } from "../hooks/use-import-preview";
import { buildImportedPost, canCreateDraft, suggestSlug } from "../import-draft";
import { IMPORT_MESSAGES as M } from "../messages";
import type { DraftInput, EditableDraftField, ImportPreview } from "../types";
import { ImportMetaFields } from "./ImportMetaFields";
import { ImportPreviewPane } from "./ImportPreviewPane";
import { ImportSourcePane } from "./ImportSourcePane";
import "../import.css";

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  /** 워크스페이스 카테고리(설정 API) — 앱이 넘긴다 */
  categories: readonly string[];
  /** 초안을 만든 뒤(편집 화면으로 가기 전) — 앱이 글 목록 캐시를 새로 고치는 자리 */
  onCreated?: () => void;
}

const NO_SUGGESTION = { title: "", description: "" };

function apiErrorMessage(error: Error | null, fallback: string): string | null {
  if (error === null) return null;
  if (error instanceof ApiError && error.userMessage !== null) return error.userMessage;
  return fallback;
}

function createErrorMessage(error: Error | null): string | null {
  if (error instanceof ConflictError) return M.slugTaken;
  return apiErrorMessage(error, M.createFailed);
}

/** 가장 최근 결과(입력 중이면 앞 입력의 자리 표시 결과)의 제안 — 변환이 막히면 빈 제안이다 */
function suggestionOf(result: ImportPreview | undefined) {
  return result?.ok === true ? result.suggested : NO_SUGGESTION;
}

/**
 * 마크다운 가져오기(결정 A) — 원문 | 미리보기, 막는 메시지, 초안으로 만들기. 변환은 서버(`/api/import/preview`),
 * 저장은 기존 `PUT` + `If-None-Match: *`. 만들면 편집 화면으로 간다.
 * 본문은 열려 있을 때만 그려진다(ModalDialog) — 닫았다 다시 열면 입력 · 오류가 처음 상태다.
 */
export function ImportDialog({ open, onClose, categories, onCreated }: ImportDialogProps) {
  const titleId = useId();
  return (
    <ModalDialog open={open} onClose={onClose} labelledBy={titleId} className="import-dialog">
      <ImportDialogBody
        titleId={titleId}
        onClose={onClose}
        categories={categories}
        {...(onCreated === undefined ? {} : { onCreated })}
      />
    </ModalDialog>
  );
}

function ImportDialogBody({
  titleId,
  onClose,
  categories,
  onCreated,
}: Omit<ImportDialogProps, "open"> & { titleId: string }) {
  const errorId = useId();
  const navigate = useNavigate();
  const [markdown, setMarkdown] = useState("");
  // 사람이 고친 칸만 기억한다 — 고치지 않은 칸은 미리보기 제안을 따라간다
  const [edited, setEdited] = useState<Partial<Record<EditableDraftField, string>>>({});
  const preview = useImportPreview(markdown);

  // 만들기 · 저장은 지금 원문의 결과만 — 앞 입력의 결과(자리 표시)로 초안을 만들지 않는다
  const current = preview.isSettled && !preview.isPlaceholderData ? (preview.data ?? null) : null;
  const suggested = suggestionOf(preview.data);
  const title = edited.title ?? suggested.title;
  const input: DraftInput = {
    title,
    slug: edited.slug ?? suggestSlug(title),
    description: edited.description ?? suggested.description,
    category: edited.category ?? categories[0] ?? "",
    date: BLOG_DATE_FORMAT.format(new Date()),
  };
  const isReady = canCreateDraft(current, input);

  const create = useMutation({
    mutationFn: async () => {
      if (current?.ok !== true) return;
      await createDraft(input.slug, buildImportedPost(current.doc, input));
    },
    onSuccess: () => {
      onCreated?.();
      onClose();
      navigate(generatePath(ROUTES.editPost, { slug: input.slug }));
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isReady) create.mutate();
  };

  const handleEdit = (field: EditableDraftField, value: string) =>
    setEdited((previous) => ({ ...previous, [field]: value }));

  const errorMessage = createErrorMessage(create.error);

  return (
    <form className="import-body" onSubmit={handleSubmit}>
      <header className="import-header">
        <h2 id={titleId} className="modal-dialog-title">
          {M.title}
        </h2>
        <p className="modal-dialog-lede">{M.lede}</p>
      </header>

      <div className="import-panes">
        <ImportSourcePane markdown={markdown} onChange={setMarkdown} />
        <ImportPreviewPane
          hasText={preview.hasText}
          isPending={preview.isFetching || !preview.isSettled}
          errorMessage={apiErrorMessage(preview.error, M.previewFailed)}
          result={preview.hasText ? (preview.data ?? null) : null}
        />
      </div>

      <ImportMetaFields input={input} categories={categories} onEdit={handleEdit} />

      {errorMessage !== null ? (
        <p id={errorId} className="import-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <div className="modal-dialog-actions">
        <button type="button" className="modal-dialog-button" onClick={onClose}>
          {M.cancel}
        </button>
        <button
          type="submit"
          className="modal-dialog-button modal-dialog-button-primary"
          disabled={!isReady || create.isPending}
          aria-describedby={errorMessage !== null ? errorId : undefined}
        >
          {create.isPending ? M.creating : M.create}
        </button>
      </div>
    </form>
  );
}
