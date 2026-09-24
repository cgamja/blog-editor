/** 플레이그라운드 `?dev` 확인 도구의 문장 — 한 곳에서 고친다 */
export const devMessages = {
  sectionLabel: "개발 확인 도구",
  fixture: "픽스처",
  toolbarLabel: "커맨드",
  insertCallout: "콜아웃 넣기",
  toneTip: "tone → tip",
  toneWarning: "tone → warning",
  insertScreenshot: "스크린샷 넣기",
  moveUp: "블록 위로",
  moveDown: "블록 아래로",
  docSummary: "현재 문서(JSON)",
  cannotSave: (reason: string) => `저장할 수 없는 문서: ${reason}`,
  sampleCaption: "플레이그라운드 예시",
} as const;
