import { useId, useState } from "react";
import { connectorStateOf } from "../connector";
import { CONNECT_MESSAGES as M } from "../messages";
import type { WorkspaceSettings } from "../types";

type CopyState = "idle" | "copied" | "failed";

const COPY_MESSAGE: Record<Exclude<CopyState, "idle">, string> = {
  copied: M.copied,
  failed: M.copyFailed,
};

/** 커넥터 주소와 복사 — 주소가 없으면 입력칸을 비우고 그 이유를 적는다 */
export function ConnectorAddress({ connector }: { connector: WorkspaceSettings["connector"] }) {
  const inputId = useId();
  const stateId = useId();
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

  const hint = copyState === "idle" ? M.state[state] : COPY_MESSAGE[copyState];

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
          aria-describedby={stateId}
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
      <p id={stateId} className="connect-hint" aria-live="polite">
        {hint}
      </p>
    </div>
  );
}
