import { SLUG_MAX_LENGTH } from "./constants";

// 한글 음절 = 0xAC00 + (초성 × 21 + 중성) × 28 + 종성(Unicode 3.12 한글 음절 조합)
const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
const VOWEL_COUNT = 21;
const FINAL_COUNT = 28;

/** 국어의 로마자 표기법(문화체육관광부 고시) 자모 표 — 소리 변화(연음 · 동화)는 적용하지 않고 글자대로 옮긴다 */
const INITIALS = [
  "g",
  "kk",
  "n",
  "d",
  "tt",
  "r",
  "m",
  "b",
  "pp",
  "s",
  "ss",
  "",
  "j",
  "jj",
  "ch",
  "k",
  "t",
  "p",
  "h",
];
const VOWELS = [
  "a",
  "ae",
  "ya",
  "yae",
  "eo",
  "e",
  "yeo",
  "ye",
  "o",
  "wa",
  "wae",
  "oe",
  "yo",
  "u",
  "wo",
  "we",
  "wi",
  "yu",
  "eu",
  "ui",
  "i",
];
const FINALS = [
  "",
  "k",
  "k",
  "k",
  "n",
  "n",
  "n",
  "t",
  "l",
  "k",
  "m",
  "l",
  "l",
  "l",
  "p",
  "l",
  "m",
  "p",
  "p",
  "t",
  "t",
  "ng",
  "t",
  "t",
  "k",
  "t",
  "p",
  "t",
];

function romanizeSyllable(code: number): string {
  const offset = code - HANGUL_FIRST;
  const initial = Math.floor(offset / (VOWEL_COUNT * FINAL_COUNT));
  const vowel = Math.floor((offset % (VOWEL_COUNT * FINAL_COUNT)) / FINAL_COUNT);
  const final = offset % FINAL_COUNT;
  return `${INITIALS[initial]}${VOWELS[vowel]}${FINALS[final]}`;
}

function romanize(text: string): string {
  return [...text]
    .map((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code >= HANGUL_FIRST && code <= HANGUL_LAST ? romanizeSyllable(code) : char;
    })
    .join("");
}

/** 80자 안에서 마지막 단어 경계까지 — 경계가 없으면 그냥 자른다 */
function clip(slug: string): string {
  if (slug.length <= SLUG_MAX_LENGTH) return slug;
  const head = slug.slice(0, SLUG_MAX_LENGTH + 1);
  const boundary = head.lastIndexOf("-");
  return (boundary > 0 ? head.slice(0, boundary) : slug.slice(0, SLUG_MAX_LENGTH)).replace(
    /-+$/,
    "",
  );
}

/**
 * 새 글 주소 제안(디자인 결정 "새 글" — 제목에서 영문으로). 한글은 로마자로, 소문자 · 숫자 밖은 하이픈 하나로.
 * 결과는 slugSchema 모양이거나 빈 문자열이다 — 비면 사람이 「글 정보」에서 적는다.
 */
export function suggestSlug(title: string): string {
  const slug = romanize(title.normalize("NFC"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clip(slug);
}
