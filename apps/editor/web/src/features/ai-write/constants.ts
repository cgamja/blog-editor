import type { ChatApp } from "./types";

/** 새 대화를 여는 주소 — 둘 다 `q`에 담긴 글로 입력창을 채운다 */
export const CHAT_APP_NEW_CHAT_URL: Readonly<Record<ChatApp, string>> = {
  claude: "https://claude.ai/new",
  chatgpt: "https://chatgpt.com/",
};

export const PROMPT_QUERY_PARAM = "q";

export const CHAT_APPS: readonly ChatApp[] = ["claude", "chatgpt"];
