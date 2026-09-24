import { MAX_STICKERS_PER_DOC } from "@blog-editor/content-schema";
import { isStickerId, type StickerId } from "./sticker-ui";

/**
 * 스티커 오버레이의 사용자 문장 — 한 곳에서 고친다(CLEAN-CODE §3 messages).
 * 스티커 이름은 꾸미기 패널(#60 · #66)도 이 모듈의 `stickerName`을 쓴다.
 */

/** 디자인 69:2 스티커 격자의 이름. 키 타입을 STICKER_IDS에서 파생해 id가 늘면 typecheck가 잡는다 */
const STICKER_NAMES: Record<StickerId, string> = {
  "star-coral": "코랄 별",
  "star-mint": "민트 별",
  heart: "하트",
  cloud: "구름",
  bottle: "젖병",
  rattle: "딸랑이",
  pacifier: "쪽쪽이",
  "foot-coral": "코랄 발자국",
  "foot-mint": "민트 발자국",
};

export const stickerName = (id: string): string => (isStickerId(id) ? STICKER_NAMES[id] : id);

/** 스티커 버튼의 접근성 이름 */
export const stickerLabel = (id: string): string => `${stickerName(id)} 스티커`;

export const removeStickerLabel = (id: string): string => `${stickerName(id)} 스티커 지우기`;

/** 스티커가 붙은 블록을 부르는 말 — 에디터 스키마의 노드 이름 기준 */
const BLOCK_NAMES: Record<string, string> = {
  paragraph: "문단",
  heading: "제목",
  bulletList: "목록",
  orderedList: "목록",
  blockquote: "인용",
  codeBlock: "코드",
  horizontalRule: "구분선",
  image: "사진",
  appScreenshot: "스크린샷",
  callout: "콜아웃",
};

export const anchorLabel = (nodeName: string): string =>
  `${BLOCK_NAMES[nodeName] ?? "블록"}에 붙어 있어요`;

export const STICKER_MESSAGES = {
  keyboardHint:
    "방향키로 옮기고, 더하기 · 빼기로 크기를, 대괄호로 회전을 바꿔요. Delete로 지우고 Esc로 나가요.",
  cannotPlace: "여기에는 놓을 수 없어요. 문단이나 사진 가까이에 놓아 주세요.",
  limit: `스티커는 글 하나에 ${MAX_STICKERS_PER_DOC}개까지예요.`,
} as const;
