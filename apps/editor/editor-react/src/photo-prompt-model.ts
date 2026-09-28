/** 프롬프트에 이미 비율 인자가 있는가 — Midjourney의 `--ar` · 같은 뜻의 `--aspect` */
const ASPECT_ARGUMENT = /(^|\s)--(ar|aspect)(\s|$)/;

/**
 * 「프롬프트 복사」가 클립보드에 넣을 글(adr-043) — 사진 자리 비율이 있으면 끝에 ` --ar W:H`를 붙여 이미지 도구가 같은
 * 모양으로 만들게 한다. 이미 비율 인자가 있거나 비율이 없으면 프롬프트 그대로다.
 */
export function promptCopyText(prompt: string, ratio: string | null | undefined): string {
  if (ratio == null || ASPECT_ARGUMENT.test(prompt)) return prompt;
  return `${prompt} --ar ${ratio}`;
}
