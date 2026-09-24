import { ConnectorAddress } from "../components/ConnectorAddress";
import { GuideForm } from "../components/GuideForm";
import { useWorkspaceSettings } from "../hooks/use-workspace-settings";
import { CONNECT_MESSAGES as M } from "../messages";
import type { WorkspaceSettings } from "../types";
import "../connect.css";

function ItemList({
  title,
  items,
  className,
}: {
  title: string;
  items: readonly string[];
  className: string;
}) {
  return (
    <div className={className}>
      <h2 className="connect-ability-title">{title}</h2>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ConnectContent({ settings }: { settings: WorkspaceSettings }) {
  return (
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
        <ConnectorAddress connector={settings.connector} />
      </section>
      <section className="connect-column" aria-label={M.guideLabel}>
        <div className="connect-abilities">
          <ItemList
            title={M.canTitle}
            items={M.can}
            className="connect-ability connect-ability-can"
          />
          <ItemList title={M.cannotTitle} items={M.cannot} className="connect-ability" />
        </div>
        <GuideForm savedGuide={settings.guide} />
      </section>
    </div>
  );
}

/** 설정 읽기 상태 하나만 그린다 — 불러오는 중 · 실패 · 본문 */
function ConnectBody() {
  const settings = useWorkspaceSettings();
  if (settings.isPending) return <p className="connect-hint">{M.loading}</p>;
  if (settings.isError) {
    return (
      <p className="connect-hint connect-hint-error" role="alert">
        {M.loadFailed}
      </p>
    );
  }
  return <ConnectContent settings={settings.data} />;
}

/** AI 연결(Figma 70:2) — 셸(nav)은 앱 레이아웃이 감싼다 */
export function ConnectPage() {
  return (
    <main className="connect-page">
      <header className="connect-header">
        <h1 className="connect-title">{M.title}</h1>
        <p className="connect-lede">{M.lede}</p>
      </header>
      <ConnectBody />
    </main>
  );
}
