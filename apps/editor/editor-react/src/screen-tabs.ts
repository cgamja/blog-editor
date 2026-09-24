/** 옆 패널 탭에서 키를 눌렀을 때 옮겨 갈 탭 번호. 모르는 키면 null. */
export function tabIndexAfterKey(current: number, key: string, count: number): number | null {
  void [current, key, count];
  throw new Error("미구현");
}
