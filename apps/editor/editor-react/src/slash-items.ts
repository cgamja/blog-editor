import { INSERTABLE_BLOCKS } from "@blog-editor/editor-core";
import type { InsertableBlockKind } from "@blog-editor/editor-core";
import { INSERTABLE_BLOCK_LABELS } from "./messages";
import { SLASH_ALIASES } from "./slash-menu.constants";

/** 「+」 메뉴와 같은 목록 · 같은 순서(spec: editor-slash-menu) */
const KINDS = Object.keys(INSERTABLE_BLOCKS) as InsertableBlockKind[];

/*
 * 한글 음절 → 자모(호환 자모). 조합 중에는 `ㅈ` → `제` → `젬` → `제모` → `제목`처럼 낱자 · 받침이 옮겨 다니므로
 * 음절째 비교하면 중간 글자가 어느 이름에도 맞지 않는다. 자모로 풀면 `젬`(ㅈㅔㅁ)이 `제목`(ㅈㅔㅁㅗㄱ)의 일부가 된다.
 * 겹모음 · 겹받침도 홑자모로 푼다 — `으`(ㅇㅡ)가 `의`(ㅇㅡㅣ)에 맞게.
 * 음절 = 0xAC00 + (초성 × 21 + 중성) × 28 + 종성 — https://www.unicode.org/versions/latest/ch03.pdf (3.12 Hangul Syllables)
 */
const SYLLABLE_BASE = 0xac00;
const SYLLABLE_COUNT = 11172;
const JUNG_COUNT = 21;
const JONG_COUNT = 28;
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = [
  ..."ㅏㅐㅑㅒㅓㅔㅕㅖㅗ",
  "ㅗㅏ",
  "ㅗㅐ",
  "ㅗㅣ",
  ..."ㅛㅜ",
  "ㅜㅓ",
  "ㅜㅔ",
  "ㅜㅣ",
  ..."ㅠㅡ",
  "ㅡㅣ",
  "ㅣ",
];
const JONG = [
  "",
  ..."ㄱㄲ",
  "ㄱㅅ",
  "ㄴ",
  "ㄴㅈ",
  "ㄴㅎ",
  ..."ㄷㄹ",
  "ㄹㄱ",
  "ㄹㅁ",
  "ㄹㅂ",
  "ㄹㅅ",
  "ㄹㅌ",
  "ㄹㅍ",
  "ㄹㅎ",
  ..."ㅁㅂ",
  "ㅂㅅ",
  ..."ㅅㅆㅇㅈㅊㅋㅌㅍㅎ",
];
/** 조합 중 낱자로 들어오는 겹모음 · 겹받침(호환 자모)도 홑자모로 */
const COMPOUND_JAMO: Readonly<Record<string, string>> = {
  ㅘ: "ㅗㅏ",
  ㅙ: "ㅗㅐ",
  ㅚ: "ㅗㅣ",
  ㅝ: "ㅜㅓ",
  ㅞ: "ㅜㅔ",
  ㅟ: "ㅜㅣ",
  ㅢ: "ㅡㅣ",
  ㄳ: "ㄱㅅ",
  ㄵ: "ㄴㅈ",
  ㄶ: "ㄴㅎ",
  ㄺ: "ㄹㄱ",
  ㄻ: "ㄹㅁ",
  ㄼ: "ㄹㅂ",
  ㄽ: "ㄹㅅ",
  ㄾ: "ㄹㅌ",
  ㄿ: "ㄹㅍ",
  ㅀ: "ㄹㅎ",
  ㅄ: "ㅂㅅ",
};

function jamoOf(char: string): string {
  const offset = char.charCodeAt(0) - SYLLABLE_BASE;
  if (offset < 0 || offset >= SYLLABLE_COUNT) return COMPOUND_JAMO[char] ?? char;
  const cho = Math.floor(offset / (JUNG_COUNT * JONG_COUNT));
  const jung = Math.floor((offset % (JUNG_COUNT * JONG_COUNT)) / JONG_COUNT);
  const jong = offset % JONG_COUNT;
  return `${CHO[cho]}${JUNG[jung]}${JONG[jong]}`;
}

/** 이름의 띄어쓰기 · 가운뎃점은 비교에서 뺀다 — query에는 공백이 들어올 수 없어(공백이면 메뉴가 닫힌다) `/큰제목`처럼 친다 */
const SEPARATORS = /[\s·]/g;

const searchKey = (text: string) =>
  [...text.toLowerCase().replace(SEPARATORS, "")].map(jamoOf).join("");

/**
 * 슬래시 메뉴 항목을 거른다 — 한글 이름이나 영문 별칭에 query가 들어 있으면(대소문자 · 띄어쓰기 무시,
 * 한글은 자모 단위) 남긴다. 빈 query면 전부다.
 */
export function filterSlashItems(query: string): InsertableBlockKind[] {
  const needle = searchKey(query);
  return KINDS.filter((kind) =>
    [INSERTABLE_BLOCK_LABELS[kind], ...SLASH_ALIASES[kind]].some((name) =>
      searchKey(name).includes(needle),
    ),
  );
}
