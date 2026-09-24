import type { ChatApp } from "./types";

const APP_NAME: Record<ChatApp, string> = { claude: "Claude", chatgpt: "ChatGPT" };

/** AI로 쓰기 대화상자 문장(Figma 71:2) */
export const AI_WRITE_MESSAGES = {
  title: "AI로 쓰기",
  lede: "채팅 앱이 새 탭으로 열려요. 글이 다 되면 여기 초안으로 올라옵니다.",
  topic: "무엇에 대해 쓸까요?",
  topicPlaceholder: "예: 신생아 수면 패턴, 첫 100일",
  category: "카테고리",
  app: "어디에서 쓸까요?",
  appName: APP_NAME,
  preview: "채팅에 이렇게 전달돼요",
  previewEmpty: "주제를 적으면 여기 보여요.",
  cancel: "취소",
  copy: "프롬프트 복사",
  copied: "복사했어요",
  copyFailed: "복사하지 못했어요. 위 글을 직접 선택해 복사해 주세요.",
  openIn: (app: ChatApp) => `${APP_NAME[app]}에서 열기`,
  opensInNewTab: "(새 탭)",
} as const;

/** 목록이 제목 글꼴 조각을 미리 받을 때 쓴다(#107) — 문구 원천은 위 한 곳 */
export const AI_WRITE_DIALOG_TITLE = AI_WRITE_MESSAGES.title;
