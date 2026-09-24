import { useId, useState } from "react";
import type { FormEvent } from "react";
import { connectorStateOf } from "../connector";
import { useSaveGuide, useWorkspaceSettings } from "../hooks/use-workspace-settings";
import { CONNECT_MESSAGES as M } from "../messages";
import type { WorkspaceSettings } from "../types";
import "../connect.css";

type CopyState = "idle" | "copied" | "failed";
type SaveGuide = ReturnType<typeof useSaveGuide>;

/** 커넥터 주소와 복사 — 주소가 없으면 입력칸 대신 이유를 적는다 */
function ConnectorAddress({ connector }: { connector: WorkspaceSettings["connector"] }) {
  const inputId = useId();
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const state = connectorStateOf(connector);

  const handleCopy = async () => {
    if (connector.url === null) return;
    try {
      await navigator.clipboard.writeText(connector.url);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <div className="connect-field">
      <label htmlFor={inputId} className="connect-label">
        {M.urlLabel}
      </label>
      <div className="connect-row">
        <input
          id={inputId}
          className="connect-input"
          readOnly
          value={connector.url ?? ""}
          aria-describedby={`${inputId}-state`}
          onFocus={(event) => event.currentTarget.select()}
        />
        <button
          type="button"
          className="connect-button"
          onClick={handleCopy}
          disabled={state !== "ready"}
        >
          {M.copy}
        </button>
      </div>
      <p id={`${inputId}-state`} className="connect-hint" aria-live="polite">
        {copyState === "copied" ? M.copied : copyState === "failed" ? M.copyFailed : M.state[state]}
      </p>
    </div>
  );
}

/**
 * 글쓰기 가이드 — 저장하면 MCP `get_writing_guide`가 형식 가이드 뒤에 붙여 AI에게 준다.
 * 저장된 가이드가 바뀌면 부모가 `key`로 새로 그려 입력을 맞춘다 — 저장 상태는 다시 그려도 남게 부모가 든다.
 */
function GuideForm({ savedGuide, save }: { savedGuide: string; save: SaveGuide }) {
  const guideId = useId();
  const statusId = useId();
  const [guide, setGuide] = useState(savedGuide);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    save.mutate(guide);
  };

  const isDirty = guide !== savedGuide;
  const status = save.isPending
    ? M.savingGuide
    : save.isError
      ? M.saveFailed
      : save.isSuccess && !isDirty
        ? M.savedGuide
        : M.guideHint;

  return (
    <form className="connect-field" onSubmit={handleSubmit}>
      <label htmlFor={guideId} className="connect-label">
        {M.guideLabel}
      </label>
      <textarea
        id={guideId}
        className="connect-guide"
        rows={9}
        value={guide}
        placeholder={M.guidePlaceholder}
        onChange={(event) => setGuide(event.target.value)}
        aria-describedby={statusId}
      />
      <div className="connect-row">
        <p
          id={statusId}
          className={save.isError ? "connect-hint connect-hint-error" : "connect-hint"}
          aria-live="polite"
        >
          {status}
        </p>
        <button type="submit" className="connect-button" disabled={!isDirty || save.isPending}>
          {M.saveGuide}
        </button>
      </div>
    </form>
  );
}

/** AI 연결(Figma 70:2) — 셸(nav)은 앱 레이아웃이 감싼다 */
export function ConnectPage() {
  const settings = useWorkspaceSettings();
  const save = useSaveGuide();

  return (
    <main className="connect-page">
      <header className="connect-header">
        <h1 className="connect-title">{M.title}</h1>
        <p className="connect-lede">{M.lede}</p>
      </header>
      {settings.isPending ? (
        <p className="connect-hint">{M.loading}</p>
      ) : settings.isError ? (
        <p className="connect-hint connect-hint-error" role="alert">
          {M.loadFailed}
        </p>
      ) : (
        <div className="connect-columns">
          <section className="connect-column" aria-label={M.urlLabel}>
            <ol className="connect-steps">
              {M.steps.map((step, index) => (
                <li key={step.title} className="connect-step">
                  <span className="connect-step-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <div className="connect-step-title">{step.title}</div>
                    <div className="connect-step-body">{step.body}</div>
                  </div>
                </li>
              ))}
            </ol>
            <ConnectorAddress connector={settings.data.connector} />
          </section>
          <section className="connect-column" aria-label={M.guideLabel}>
            <div className="connect-abilities">
              <div className="connect-ability connect-ability-can">
                <h2 className="connect-ability-title">{M.canTitle}</h2>
                <ul>
                  {M.can.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="connect-ability">
                <h2 className="connect-ability-title">{M.cannotTitle}</h2>
                <ul>
                  {M.cannot.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
            <GuideForm key={settings.data.guide} savedGuide={settings.data.guide} save={save} />
          </section>
        </div>
      )}
    </main>
  );
}
