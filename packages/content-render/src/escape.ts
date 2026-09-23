/**
 * 텍스트와 속성값 공통 escape(spec: html-render "텍스트와 속성값은 항상 이스케이프된다").
 * `&`부터 바꿔야 그다음에 넣는 엔티티의 `&`가 다시 이스케이프되지 않는다.
 */
const ESCAPE_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const ESCAPE_PATTERN = /[&<>"']/g;

export function escapeHtml(text: string): string {
  return text.replace(ESCAPE_PATTERN, (char) => ESCAPE_ENTITIES[char]!);
}
