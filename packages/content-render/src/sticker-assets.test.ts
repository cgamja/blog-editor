/// <reference types="node" />
import { readFileSync } from "node:fs";
import { STICKER_IDS } from "@blog-editor/content-schema";
import { STICKER_SIZES } from "./stickers";

// PNG는 8바이트 서명 뒤 첫 청크가 IHDR이다. 청크는 길이(4) · 타입(4) · 데이터 순이고,
// IHDR 데이터의 앞 8바이트가 너비 · 높이(빅엔디언 u32)다. https://www.w3.org/TR/png-3/#5Chunk-layout ·
// https://www.w3.org/TR/png-3/#11IHDR
const PNG_SIGNATURE = "89504e470d0a1a0a";
const PNG_SIGNATURE_LENGTH = 8;
const CHUNK_LENGTH_SIZE = 4;
const CHUNK_TYPE_OFFSET = PNG_SIGNATURE_LENGTH + CHUNK_LENGTH_SIZE;
const CHUNK_TYPE_SIZE = 4;
const IHDR_WIDTH_OFFSET = CHUNK_TYPE_OFFSET + CHUNK_TYPE_SIZE;
const IHDR_HEIGHT_OFFSET = IHDR_WIDTH_OFFSET + 4;

function pngSize(bytes: Buffer): { width: number; height: number } {
  if (bytes.subarray(0, PNG_SIGNATURE_LENGTH).toString("hex") !== PNG_SIGNATURE)
    throw new Error("PNG가 아니다");
  const chunkType = bytes.subarray(CHUNK_TYPE_OFFSET, CHUNK_TYPE_OFFSET + CHUNK_TYPE_SIZE);
  if (chunkType.toString("latin1") !== "IHDR") throw new Error("첫 청크가 IHDR가 아니다");
  return {
    width: bytes.readUInt32BE(IHDR_WIDTH_OFFSET),
    height: bytes.readUInt32BE(IHDR_HEIGHT_OFFSET),
  };
}

describe("render-decoration: 스티커 원본 파일은 크기 상수와 같다", () => {
  it("WHEN STICKER_IDS마다 assets/stickers/{id}.png의 PNG 헤더를 읽는다 THEN 아홉 장 모두 있고 너비 · 높이가 STICKER_SIZES와 같다", () => {
    const sizes = STICKER_IDS.map((id) => [
      id,
      pngSize(readFileSync(new URL(`../assets/stickers/${id}.png`, import.meta.url))),
    ]);

    expect(Object.fromEntries(sizes)).toEqual(STICKER_SIZES);
  });
});
