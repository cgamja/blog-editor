/**
 * 옆 패널 탭에서 키를 눌렀을 때 옮겨 갈 탭 번호. 모르는 키면 null — 기본 동작을 막지 않는다.
 * ←/→는 끝에서 반대쪽 끝으로 돈다(WAI-ARIA APG Tabs: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).
 */
export function tabIndexAfterKey(current: number, key: string, count: number): number | null {
  if (key === "ArrowRight") return (current + 1) % count;
  if (key === "ArrowLeft") return (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}
