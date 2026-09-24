import type { ChatApp } from "./types";

/** 채팅 앱에 보낼 부탁 — 커넥터로 초안을 올리고, 쓰기 전에 글쓰기 가이드를 읽게 한다 */
export function buildWritePrompt(topic: string, category: string): string {
  throw new Error(`미구현: ${topic} ${category}`);
}

/** 그 채팅 앱의 새 대화 주소 — 프롬프트를 `q`로 싣는다 */
export function chatAppUrl(app: ChatApp, prompt: string): string {
  throw new Error(`미구현: ${app} ${prompt}`);
}
