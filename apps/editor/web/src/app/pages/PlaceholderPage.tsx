import { MESSAGES } from "../../shared/messages";

/** 화면 이슈가 채우기 전의 자리 — 라우트 · 가드가 이어지는지만 보인다. */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="app-placeholder">
      <h1 className="page-title">{title}</h1>
      <p>{MESSAGES.placeholder}</p>
    </div>
  );
}
