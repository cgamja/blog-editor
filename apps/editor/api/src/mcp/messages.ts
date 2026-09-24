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
