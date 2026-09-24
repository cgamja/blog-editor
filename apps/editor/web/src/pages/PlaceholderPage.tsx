import { MESSAGES } from "../messages";

/** 화면 이슈가 채우기 전의 자리 — 라우트 · 가드가 이어지는지만 보인다. */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <main className="app-page">
      <h1>{title}</h1>
      <p>{MESSAGES.placeholder}</p>
    </main>
  );
}
