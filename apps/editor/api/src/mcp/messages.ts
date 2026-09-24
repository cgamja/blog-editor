/**
 * MCP 도구 오류 문장 — 받는 쪽은 AI다. 무엇이 틀렸고 다음에 어느 도구를 부르면 되는지를 같이 적어
 * AI가 스스로 고치게 한다(adr-007 "검증 실패 메시지를 보고 AI가 스스로 고친다").
 */
export const MCP_UNAUTHORIZED_MESSAGE =
  "연결용 토큰이 없거나 맞지 않는다 — Authorization: Bearer <토큰>으로 보낸다";
export const MCP_POST_NOT_FOUND_MESSAGE = "그 slug의 글이 없다 — list_posts로 slug를 확인한다";
export const MCP_PUBLISHED_READ_ONLY_MESSAGE =
  "발행된 글은 MCP로 고칠 수 없다 — 사람이 에디터에서 고친다. 새 글은 create_draft로 쓴다";
export const MCP_SLUG_TAKEN_MESSAGE =
  "이미 있는 slug다 — 다른 slug로 create_draft하거나, get_post로 읽고 update_draft로 고친다";
export const MCP_CONFLICT_MESSAGE =
  "그사이 다른 곳에서 글이 바뀌었다 — get_post로 다시 읽고 새 revision으로 update_draft한다";
export const MCP_META_MISMATCH_MESSAGE = "글 정보가 형식에 맞지 않는다";
export const MCP_INTERNAL_ERROR_MESSAGE =
  "서버에서 처리하지 못했다 — 잠시 뒤 다시 시도하고, 계속되면 사람에게 알린다";
const BYTES_PER_KIB = 1024;

/** 한도는 route.ts의 상수 하나가 정한다 — 문장은 그 값에서 만든다 */
export function bodyTooLargeMessage(maxBytes: number): string {
  return `요청이 너무 크다 — 본문은 ${maxBytes / BYTES_PER_KIB} KiB까지다`;
}

/** 도구 이름 · 설명 — AI가 도구를 고르는 근거라 문장도 계약이다 */
export const MCP_TOOL_TEXT = {
  get_writing_guide: {
    title: "글쓰기 가이드",
    description:
      "초안을 쓰기 전에 가장 먼저 읽는다. 블록 문법 · 콜아웃 · 꾸미기 지시어 · 이미지 규칙을 담은 형식 가이드다.",
  },
  list_posts: {
    title: "글 목록",
    description: "초안과 발행된 글의 요약(slug · 제목 · 초안 여부 · 날짜 · 카테고리). 읽기 전용.",
  },
  get_post: {
    title: "글 읽기",
    description:
      "글 하나를 markdown으로 읽는다. update_draft에 넘길 revision과, markdown으로 옮기지 못한 것(losses)을 함께 준다.",
  },
  check_draft: {
    title: "형식 검사",
    description: "저장하지 않고 markdown 형식만 검사해 틀린 곳을 알려준다.",
  },
  create_draft: {
    title: "초안 만들기",
    description:
      "markdown과 글 정보로 새 초안을 저장한다. 항상 초안이고 발행은 사람이 에디터에서 한다. 응답의 editorUrl을 사용자에게 알려준다.",
  },
  update_draft: {
    title: "초안 고치기",
    description:
      "get_post로 받은 revision으로 초안을 고쳐 쓴다. 그사이 바뀌었으면 충돌이다. 발행된 글은 고치지 못한다.",
  },
} as const;
