import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { generatePath, useNavigate } from "react-router";
import { HTTP_CONFLICT } from "../../../shared/api/constants";
import { ApiError } from "../../../shared/api/errors";
import { ROUTES } from "../../../shared/routes/constants";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { createDraft } from "../api";
import { BLOG_DATE_FORMAT, MARKDOWN_FILE_ACCEPT } from "../constants";
import { useImportPreview } from "../hooks/use-import-preview";
import { buildImportedPost, canCreateDraft, suggestSlug } from "../import-draft";
import { IMPORT_MESSAGES as M } from "../messages";
import type { DraftInput, EditableDraftField } from "../types";
import { ImportMetaFields } from "./ImportMetaFields";
import { ImportPreviewPane } from "./ImportPreviewPane";
import "../import.css";

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  /** 워크스페이스 카테고리(설정 API) — 앱이 넘긴다 */
  categories: readonly string[];
}

function createErrorMessage(error: Error | null): string | null {
  if (error === null) return null;
  if (error instanceof ApiError && error.status === HTTP_CONFLICT) return M.slugTaken;
  if (error instanceof ApiError && error.userMessage !== null) return error.userMessage;
  return M.createFailed;
}

/**
 * 마크다운 가져오기(결정 A) — 원문 | 미리보기, 막는 메시지, 초안으로 만들기. 변환은 서버(`/api/import/preview`),
 * 저장은 기존 `PUT` + `If-None-Match: *`. 만들면 편집 화면으로 간다.
 */
export function ImportDialog({ open, onClose, categories }: ImportDialogProps) {
  const titleId = useId();
  const sourceId = useId();
  const fileId = useId();
  const errorId = useId();
  const navigate = useNavigate();
  const [markdown, setMarkdown] = useState("");
  const [fileError, setFileError] = useState(false);
  // 사람이 고친 칸만 기억한다 — 고치지 않은 칸은 미리보기 제안을 따라간다
  const [edited, setEdited] = useState<Partial<Record<EditableDraftField, string>>>({});
  const preview = useImportPreview(markdown);

  // 지금 원문의 결과만 만들기에 쓴다 — 앞 입력의 결과(자리 표시)로 초안을 만들지 않는다
  const current = preview.isSettled && !preview.isPlaceholderData ? (preview.data ?? null) : null;
  const suggested = current?.ok === true ? current.suggested : { title: "", description: "" };
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
      onClose();
      navigate(generatePath(ROUTES.editPost, { slug: input.slug }));
    },
  });

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;
    try {
      setMarkdown(await file.text());
      setFileError(false);
    } catch {
      setFileError(true);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isReady) create.mutate();
  };

  const handleEdit = (field: EditableDraftField, value: string) =>
    setEdited((previous) => ({ ...previous, [field]: value }));

  const errorMessage = createErrorMessage(create.error);

  return (
    <ModalDialog open={open} onClose={onClose} labelledBy={titleId} className="import-dialog">
      <form className="import-body" onSubmit={handleSubmit}>
        <header className="import-header">
          <h2 id={titleId} className="modal-dialog-title">
            {M.title}
          </h2>
          <p className="modal-dialog-lede">{M.lede}</p>
        </header>

        <div className="import-panes">
          <div className="import-pane">
            <div className="import-pane-head">
              <label htmlFor={sourceId} className="modal-dialog-label">
                {M.source}
              </label>
              <label htmlFor={fileId} className="import-file">
                {M.pickFile}
              </label>
              <input
                id={fileId}
                className="import-file-input"
                type="file"
                accept={MARKDOWN_FILE_ACCEPT}
                onChange={handleFile}
              />
            </div>
            <textarea
              id={sourceId}
              className="import-source"
              value={markdown}
              placeholder={M.sourcePlaceholder}
              onChange={(event) => setMarkdown(event.target.value)}
              spellCheck={false}
            />
            {fileError ? (
              <p className="import-error" role="alert">
                {M.fileFailed}
              </p>
            ) : null}
          </div>
          <ImportPreviewPane
            hasText={preview.hasText}
            isPending={preview.isFetching || !preview.isSettled}
            isError={preview.isError}
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
    </ModalDialog>
  );
}
