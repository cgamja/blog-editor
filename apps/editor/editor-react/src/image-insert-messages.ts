import { IMAGE_MAX_BYTES } from "@blog-editor/content-schema";

const BYTES_PER_MB = 1024 * 1024;

/** 이미지 넣기(이슈 #92)에서 화면에 보이는 문장 — 한 곳에 모은다. */
export const IMAGE_INSERT_MESSAGES = {
  loginRequired: "로그인이 필요해요",
  uploadFailed: "이미지를 올리지 못했어요",
  networkFailed: "서버에 닿지 못했어요 — 연결을 확인하고 다시 시도해 주세요",
  cannotDecode: "이 파일은 이미지로 열 수 없어요",
  tooLarge: `줄여도 ${IMAGE_MAX_BYTES / BYTES_PER_MB}MB를 넘어요 — 더 작은 이미지를 골라 주세요`,
  uploading: "이미지를 올리는 중…",
  retry: "다시 시도",
  remove: "지우기",
  altButton: "대체 텍스트",
  altMissing: "대체 텍스트 없음",
  altLabel: "이 그림을 설명하는 글(대체 텍스트)",
  altHint: "화면을 읽어 주는 프로그램과 검색에 쓰여요. Enter로 적용, Esc로 닫기",
  // 사진 자리 · 사진 설명(adr-033)
  placeholderToolbar: "사진 자리",
  uploadPhoto: "사진 올리기",
  briefButton: "사진 설명",
  briefLabel: "사진 설명(에디터에만 보여요)",
  briefHint:
    "어떤 사진인지 적어 두면 사진을 고르거나 바꿀 때 참고가 돼요. 공개 글에는 나오지 않아요. Enter로 적용, Esc로 닫기",
  toPlaceholder: "사진 자리로 되돌리기",
} as const;
