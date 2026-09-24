import { useId, useRef, useState } from "react";
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
  // 읽기는 비동기라 앞 파일이 늦게 끝날 수 있다 — 마지막으로 고른 파일 · 입력만 반영한다
  const readSeq = useRef(0);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;
    readSeq.current += 1;
    const seq = readSeq.current;
    const problem = markdownFileProblem(file);
    if (problem !== null) {
      setFileError(FILE_PROBLEM_MESSAGE[problem]);
      return;
    }
    try {
      const text = await file.text();
      if (seq !== readSeq.current) return;
      onChange(text);
      setFileError(null);
    } catch {
      if (seq === readSeq.current) setFileError(M.fileFailed);
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
        onChange={(event) => {
          readSeq.current += 1;
          onChange(event.target.value);
        }}
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
