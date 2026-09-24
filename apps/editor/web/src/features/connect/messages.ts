import type { ConnectorState } from "./types";

/** AI 연결 화면 문장(Figma 70:2) */
export const CONNECT_MESSAGES = {
  title: "AI 연결",
  lede: "쓰고 있는 Claude나 ChatGPT를 이 블로그에 연결하면, 채팅에서 부탁한 글이 여기 초안으로 올라와요. AI 요금은 따로 들지 않습니다.",
  steps: [
    { title: "주소를 복사해요", body: "아래 커넥터 주소를 복사합니다." },
    {
      title: "채팅 앱 설정에 붙여 넣어요",
      body: "Claude나 ChatGPT의 설정에서 커넥터 추가를 누르고 주소를 붙여 넣습니다.",
    },
    {
      title: "이 에디터 계정으로 승인해요",
      body: "로그인 창이 뜨면 승인합니다. 한 번만 하면 돼요.",
    },
  ],
  urlLabel: "커넥터 주소",
  copy: "주소 복사",
  copied: "복사했어요",
  copyFailed: "복사하지 못했어요. 주소를 직접 선택해 복사해 주세요.",
  state: {
    ready: "주소가 열려 있어요. 연결 상태와 연결 끊기는 각 채팅 앱의 커넥터 설정에서 봐요.",
    "no-public-url":
      "커넥터는 켜져 있지만 채팅 앱이 닿는 공개 주소가 아직 없어요(서버 PUBLIC_BASE_URL).",
    off: "커넥터가 꺼져 있어요(서버 MCP_CONNECTION_TOKEN).",
  } satisfies Record<ConnectorState, string>,
  canTitle: "AI가 할 수 있는 일",
  can: ["글 목록과 글 읽기", "새 초안 만들기", "초안 고치기"],
  cannotTitle: "AI가 할 수 없는 일",
  cannot: ["발행하기", "발행된 글 고치기", "글 지우기"],
  guideLabel: "글쓰기 가이드",
  guideHint: "AI가 글을 쓰기 전에 가장 먼저 읽는 안내예요.",
  guidePlaceholder: "말투 · 독자 · 구성 · 피할 표현을 적어 주세요.",
  saveGuide: "가이드 저장",
  savingGuide: "저장하는 중…",
  savedGuide: "저장했어요",
  saveFailed: "저장하지 못했어요. 다시 시도해 주세요.",
  loading: "설정을 불러오는 중이에요.",
  loadFailed: "설정을 불러오지 못했어요.",
} as const;
