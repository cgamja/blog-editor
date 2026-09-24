/** 가져오기 대화상자 문장(결정 A — 대화상자 한 장) */
export const IMPORT_MESSAGES = {
  title: "마크다운 가져오기",
  lede: "쓰던 마크다운을 붙여 넣거나 .md 파일을 고르세요. 초안으로 만든 뒤 편집 화면에서 다듬어요.",
  source: "원문",
  sourcePlaceholder: "여기에 마크다운을 붙여 넣으세요.",
  pickFile: ".md 파일 고르기",
  fileFailed: "파일을 읽지 못했어요.",
  fileExtension: ".md · .markdown 파일만 가져올 수 있어요.",
  fileSize: "파일이 너무 커요. 한 편씩 나눠 가져와 주세요.",
  preview: "미리보기",
  previewEmpty: "원문을 넣으면 공개 페이지 모양으로 보여요.",
  previewLoading: "바꾸는 중…",
  previewFailed: "미리보기를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.",
  previewFrameTitle: "공개 페이지 미리보기",
  blocked: (count: number) => `이대로는 가져올 수 없어요 — ${count}곳을 고쳐 주세요`,
  titleLabel: "제목",
  slugLabel: "주소",
  slugHint: "소문자 · 숫자 · 하이픈. 발행 전까지 「글 정보」에서 바꿀 수 있어요.",
  categoryLabel: "카테고리",
  descriptionLabel: "설명",
  cancel: "취소",
  create: "초안으로 만들기",
  creating: "만드는 중…",
  slugTaken: "그 주소에 이미 글이 있어요. 다른 주소를 써 주세요.",
  createFailed: "초안을 만들지 못했어요. 다시 시도해 주세요.",
} as const;

/** 목록이 제목 글꼴 조각을 미리 받을 때 쓴다(#107) — 문구 원천은 위 한 곳 */
export const IMPORT_DIALOG_TITLE = IMPORT_MESSAGES.title;
