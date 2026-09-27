import { STICKER_IDS, STICKER_RANGES } from "@blog-editor/content-schema";
import type { Sticker } from "@blog-editor/content-schema";
import {
  STICKER_DIRECTIVE_KEY,
  STICKER_KIND_SEPARATOR as KIND_SEPARATOR,
  STICKER_NUMBER_SEPARATOR as NUMBER_SEPARATOR,
} from "./constants";

/**
 * 스티커 지시어 값 `<종류>@<x>,<y>,<크기>[,<회전>]`(adr-032) — directives.ts(읽기)와 serialize.ts ·
 * range-edit.ts(쓰기)가 같이 쓴다.
 * 좌표 · 크기는 블록 기준 %, 회전은 도(adr-008)라 markdown에 그대로 적어도 뜻이 같다.
 */

const INT = "(-?\\d+)";
// 모양만 본다 — 종류 · 범위는 닫힌 집합으로 따로 본다(틀린 곳마다 다른 메시지)
const STICKER_VALUE = new RegExp(
  `^([^${KIND_SEPARATOR}${NUMBER_SEPARATOR}\\s]+)${KIND_SEPARATOR}${[INT, INT, INT].join(NUMBER_SEPARATOR)}(?:${NUMBER_SEPARATOR}${INT})?$`,
);
/** 읽을 때만 생략을 받는다 — 정규형 쓰기에서는 늘 적는다 */
const DEFAULT_ROTATE = 0;

export type StickerRead = { ok: true; sticker: Sticker } | { ok: false; reason: "kind" | "value" };

/** `-0`은 0으로 — 정규형 doc에 음의 0이 들어가지 않게 */
const toInt = (digits: string) => Number(digits) || 0;

const isIn = (n: number, range: { min: number; max: number }) => n >= range.min && n <= range.max;

export function readStickerValue(value: string): StickerRead {
  const match = STICKER_VALUE.exec(value);
  if (match === null) return { ok: false, reason: "value" };
  const [, kind, x, y, size, rotate] = match;
  if (!(STICKER_IDS as readonly string[]).includes(kind!)) return { ok: false, reason: "kind" };
  const sticker = {
    id: kind as Sticker["id"],
    x: toInt(x!),
    y: toInt(y!),
    size: toInt(size!),
    rotate: rotate === undefined ? DEFAULT_ROTATE : toInt(rotate),
  };
  const isInRange =
    isIn(sticker.x, STICKER_RANGES.x) &&
    isIn(sticker.y, STICKER_RANGES.y) &&
    isIn(sticker.size, STICKER_RANGES.size) &&
    isIn(sticker.rotate, STICKER_RANGES.rotate);
  return isInRange ? { ok: true, sticker } : { ok: false, reason: "value" };
}

/** 정규형 쓰기 `sticker=<종류>@<x>,<y>,<크기>,<회전>` — 회전도 늘 적는다 */
export function formatStickerDirective({ id, x, y, size, rotate }: Sticker): string {
  return `${STICKER_DIRECTIVE_KEY}=${id}${KIND_SEPARATOR}${[x, y, size, rotate].join(NUMBER_SEPARATOR)}`;
}
