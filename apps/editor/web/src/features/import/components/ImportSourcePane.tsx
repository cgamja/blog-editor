import { useId, useState } from "react";
import type { ChangeEvent } from "react";
import { MARKDOWN_FILE_ACCEPT } from "../constants";
import { markdownFileProblem } from "../import-draft";
import { IMPORT_MESSAGES as M } from "../messages";
import type { MarkdownFileProblem } from "../types";

const FILE_PROBLEM_MESSAGE: Record<MarkdownFileProblem, string> = {
  extension: M.fileExtension,
  size: M.fileSize,
};

interface ImportSourcePaneProps {
  markdown: string;
  onChange: (markdown: string) => void;
}

/** 왼쪽 칸 — 원문 붙여넣기와 .md 파일 고르기(확장자 · 크기를 본 뒤에만 읽는다) */
export function ImportSourcePane({ markdown, onChange }: ImportSourcePaneProps) {
  const sourceId = useId();
  const fileId = useId();
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;
    const problem = markdownFileProblem(file);
    if (problem !== null) {
      setFileError(FILE_PROBLEM_MESSAGE[problem]);
      return;
    }
    try {
      onChange(await file.text());
      setFileError(null);
    } catch {
      setFileError(M.fileFailed);
    }
  };

  return (
    <div className="import-pane">
      <div className="import-pane-head">
        <label htmlFor={sourceId} className="modal-dialog-label">
          {M.source}
        </label>
      </div>
      {/* 원문이 첫 포커스 자리다 — showModal()은 대화상자 안 첫 포커스 가능 요소로 옮긴다 */}
      <textarea
        id={sourceId}
        className="import-source"
        value={markdown}
        placeholder={M.sourcePlaceholder}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
      />
      <div className="import-file-row">
        <input
          id={fileId}
          className="import-file-input"
          type="file"
          accept={MARKDOWN_FILE_ACCEPT}
          onChange={handleFile}
        />
        <label htmlFor={fileId} className="import-file">
          {M.pickFile}
        </label>
      </div>
      {fileError !== null ? (
        <p className="import-error" role="alert">
          {fileError}
        </p>
      ) : null}
    </div>
  );
}
