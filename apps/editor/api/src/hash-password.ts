/**
 * 시드 계정의 `ADMIN_PASSWORD_HASH`를 만든다 — `node apps/editor/api/src/hash-password.ts`.
 * 비밀번호는 인자가 아니라 표준 입력으로 받는다(쉘 이력 · 프로세스 목록에 남지 않게).
 * 예: `printf '%s' "$(pbpaste)" | node apps/editor/api/src/hash-password.ts`
 * 비밀번호는 비밀번호 관리자가 만든 20자 이상 무작위 문자열이어야 한다(D8 — 방어의 핵심이 길이다).
 */
import { text } from "node:stream/consumers";

// Node는 확장자 없는 상대 import를 못 풀고, tsc는 `.ts` 확장자 import를 거부한다(serve.ts 머리 주석).
// 모듈 하나라 해석 훅 대신 URL로 불러오고 타입은 확장자 없는 경로에서 가져온다
const { hashPassword } = (await import(
  new URL("./password.ts", import.meta.url).href
)) as typeof import("./password");

const MIN_PASSWORD_LENGTH = 20;

const password = (await text(process.stdin)).replace(/\r?\n$/, "");
if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(`비밀번호가 ${MIN_PASSWORD_LENGTH}자보다 짧다 — 무작위로 더 길게 만든다(D8)`);
  process.exit(1);
}
console.log(await hashPassword(password));
