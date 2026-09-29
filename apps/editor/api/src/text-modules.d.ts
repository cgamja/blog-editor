// 배포 번들(scripts/build-edge.ts)은 `.css` · `.md`를 text 모듈로 넣는다 — 기본 내보내기가 파일 원문 문자열이다(ADR-046).
// 로컬 · 테스트는 이 import를 쓰지 않고 파일을 읽는다(app.ts · mcp/env.ts).
declare module "*.css" {
  const text: string;
  export default text;
}

declare module "*.md" {
  const text: string;
  export default text;
}
