import { createHash } from "node:crypto";

/** revision = 저장된 텍스트의 해시(plan 3-6 FilePostStore). 같은 내용이면 같은 revision이다. */
export function revisionOf(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** 저장 텍스트 모양 하나 — 파일 저장소가 디스크에 쓰는 바이트와 revision이 같은 것을 본다. */
export function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
