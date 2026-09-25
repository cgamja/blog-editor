/** 글 날짜는 블로그 독자 기준 — 한국 아침에 쓴 초안이 UTC 어제로 찍히지 않게 */
const BLOG_TIME_ZONE = "Asia/Seoul";
// en-CA 로캘은 날짜를 YYYY-MM-DD로 쓴다
const ISO_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: BLOG_TIME_ZONE });

/** 오늘(블로그 시간대, `YYYY-MM-DD`) — 새 초안의 `date` · 발행 글 `updated`가 같은 날짜를 쓴다 */
export function blogToday(): string {
  return ISO_DATE_FORMAT.format(new Date());
}
