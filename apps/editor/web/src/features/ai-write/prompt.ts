import { CHAT_APP_NEW_CHAT_URL, PROMPT_QUERY_PARAM } from "./constants";
import type { ChatApp } from "./types";

/** 채팅 앱에 보낼 부탁 — 커넥터로 초안을 올리고, 쓰기 전에 글쓰기 가이드를 읽게 한다(Figma 71:2 문구) */
export function buildWritePrompt(topic: string, category: string): string {
  return `블로그 에디터 커넥터로 「${topic.trim()}」 글을 써서 초안으로 올려 줘. 카테고리는 ${category}. 먼저 글쓰기 가이드를 읽어 줘.`;
}

/** 그 채팅 앱의 새 대화 주소 — 프롬프트를 `q`로 싣는다 */
export function chatAppUrl(app: ChatApp, prompt: string): string {
  const url = new URL(CHAT_APP_NEW_CHAT_URL[app]);
  url.searchParams.set(PROMPT_QUERY_PARAM, prompt);
  return url.href;
}
