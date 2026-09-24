import { useEffect } from "react";

const DISPLAY_FONT_VAR = "--font-display";
/** 제목 글꼴을 쓰는 곳은 모두 이 굵기다(Jua는 400 하나뿐) */
const DISPLAY_FONT_WEIGHT = 400;

/**
 * 나중에 뜰 제목(대화상자 등)의 제목 글꼴 조각을 미리 받는다(#107). Google Fonts는 한글 글꼴을 unicode-range 조각
 * 수십 개로 나누고, 브라우저는 그려질 글자가 든 조각만 그때 받는다
 * (https://developer.mozilla.org/docs/Web/CSS/@font-face/unicode-range). 그래서 대화상자가 처음 뜨는 순간에는 아직
 * 안 받은 조각의 글자만 `display=swap` 대체 글꼴로 그려져 굵기가 섞여 보인다.
 * `FontFaceSet.load`는 주어진 글자에 필요한 조각을 받는다(https://developer.mozilla.org/docs/Web/API/FontFaceSet/load).
 */
export function useWarmDisplayFont(texts: readonly string[]) {
  const text = texts.join("");
  useEffect(() => {
    const family = getComputedStyle(document.documentElement)
      .getPropertyValue(DISPLAY_FONT_VAR)
      .trim();
    if (family === "") return;
    // 못 받아도 잃는 것은 미리 받기뿐이다 — 대화상자가 뜰 때 브라우저가 다시 받는다
    document.fonts.load(`${DISPLAY_FONT_WEIGHT} 1em ${family}`, text).catch(() => undefined);
  }, [text]);
}
