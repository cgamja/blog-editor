import { useId, useState } from "react";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { CHAT_APPS } from "../constants";
import { AI_WRITE_MESSAGES as M } from "../messages";
import { buildWritePrompt, chatAppUrl } from "../prompt";
import type { ChatApp } from "../types";
import "../ai-write.css";

interface WriteWithAIDialogProps {
  open: boolean;
  onClose: () => void;
  /** 워크스페이스 카테고리(설정 API) — 앱이 넘긴다 */
  categories: readonly string[];
}

type CopyState = "idle" | "copied" | "failed";

const COPY_MESSAGE: Record<Exclude<CopyState, "idle">, string> = {
  copied: M.copied,
  failed: M.copyFailed,
};

/**
 * AI로 쓰기(Figma 71:2) — 프롬프트를 만들어 채팅 앱을 새 탭으로 연다. AI를 직접 부르지 않는다:
 * 채팅 앱이 커넥터(`/mcp`)로 초안을 올린다. 본문은 열려 있을 때만 그려져 다시 열면 처음 상태다.
 */
export function WriteWithAIDialog({ open, onClose, categories }: WriteWithAIDialogProps) {
  const titleId = useId();
  return (
    <ModalDialog open={open} onClose={onClose} labelledBy={titleId} className="ai-write">
      <WriteWithAIBody titleId={titleId} onClose={onClose} categories={categories} />
    </ModalDialog>
  );
}

function WriteWithAIBody({
  titleId,
  onClose,
  categories,
}: Omit<WriteWithAIDialogProps, "open"> & { titleId: string }) {
  const topicId = useId();
  const categoryId = useId();
  const [topic, setTopic] = useState("");
  const [chosenCategory, setCategory] = useState<string | null>(null);
  const [app, setApp] = useState<ChatApp>("claude");
  const [copyState, setCopyState] = useState<CopyState>("idle");

  // 카테고리 목록이 늦게 와도 첫 값을 고른 것으로 본다 — 목록에 없는 값은 남기지 않는다
  const category =
    chosenCategory !== null && categories.includes(chosenCategory)
      ? chosenCategory
      : (categories[0] ?? "");
  const hasTopic = topic.trim() !== "";
  const prompt = hasTopic ? buildWritePrompt(topic, category) : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <div className="ai-write-body">
      <header className="ai-write-header">
        <h2 id={titleId} className="modal-dialog-title">
          {M.title}
        </h2>
        <p className="modal-dialog-lede">{M.lede}</p>
      </header>
      <div className="ai-write-field">
        <label htmlFor={topicId} className="modal-dialog-label">
          {M.topic}
        </label>
        <input
          id={topicId}
          className="modal-dialog-control"
          value={topic}
          placeholder={M.topicPlaceholder}
          onChange={(event) => {
            setTopic(event.target.value);
            setCopyState("idle");
          }}
        />
      </div>
      <div className="ai-write-field">
        <label htmlFor={categoryId} className="modal-dialog-label">
          {M.category}
        </label>
        <select
          id={categoryId}
          className="modal-dialog-control"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {categories.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="ai-write-apps">
        <legend className="modal-dialog-label">{M.app}</legend>
        <div className="ai-write-app-row">
          {CHAT_APPS.map((name) => (
            <label key={name} className="ai-write-app">
              <input
                type="radio"
                name="chat-app"
                value={name}
                checked={app === name}
                onChange={() => setApp(name)}
              />
              {M.appName[name]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="ai-write-field">
        <div className="modal-dialog-label">{M.preview}</div>
        <p className="ai-write-prompt" aria-live="polite">
          {hasTopic ? prompt : M.previewEmpty}
        </p>
        {copyState !== "idle" ? (
          <p className="ai-write-copy-state" role="status">
            {COPY_MESSAGE[copyState]}
          </p>
        ) : null}
      </div>
      <div className="modal-dialog-actions">
        <button type="button" className="modal-dialog-button" onClick={onClose}>
          {M.cancel}
        </button>
        <button
          type="button"
          className="modal-dialog-button"
          onClick={handleCopy}
          disabled={!hasTopic}
        >
          {M.copy}
        </button>
        {hasTopic ? (
          <a
            className="modal-dialog-button modal-dialog-button-primary"
            href={chatAppUrl(app, prompt)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {M.openIn(app)}
            <span className="ai-write-sr-only"> {M.opensInNewTab}</span>
          </a>
        ) : (
          <button
            type="button"
            className="modal-dialog-button modal-dialog-button-primary"
            disabled
          >
            {M.openIn(app)}
          </button>
        )}
      </div>
    </div>
  );
}
