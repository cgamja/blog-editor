import type { Align } from "./decoration-types";

/** 줄 네 개의 [시작 x, 끝 x] — 정렬에 따라 짧은 줄이 붙는 쪽이 다르다(24 격자) */
const LINES: Record<Align, ReadonlyArray<readonly [number, number]>> = {
  left: [
    [4, 20],
    [4, 14],
    [4, 20],
    [4, 14],
  ],
  center: [
    [4, 20],
    [7, 17],
    [4, 20],
    [7, 17],
  ],
  right: [
    [4, 20],
    [10, 20],
    [4, 20],
    [10, 20],
  ],
};

const LINE_YS = [6, 10, 14, 18] as const;

/** 정렬 아이콘 — 글자색(currentColor)을 따른다. 이름은 부르는 버튼의 aria-label이 준다 */
export function AlignIcon({ align }: { align: Align }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {LINES[align].map(([x1, x2], index) => (
        <line key={LINE_YS[index]} x1={x1} x2={x2} y1={LINE_YS[index]} y2={LINE_YS[index]} />
      ))}
    </svg>
  );
}
