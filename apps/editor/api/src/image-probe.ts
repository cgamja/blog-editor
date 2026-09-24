/**
 * 이미지 형식과 가로 · 세로를 헤더 바이트만으로 판정한다(ADR-021, design.md 2). 확장자 · Content-Type은
 * 믿지 않는다. 서명이 없거나(SVG · 텍스트) 헤더가 잘렸거나 크기가 0이면 null.
 * 바이트 위치는 각 형식 명세에 고정되어 있다:
 * PNG https://www.w3.org/TR/png-3/#11IHDR · GIF https://www.w3.org/Graphics/GIF/spec-gif89a.txt
 * WebP https://developers.google.com/speed/webp/docs/riff_container · JPEG ITU-T T.81 B.2
 */
export type ImageFormat = "jpeg" | "png" | "webp" | "gif";

export interface ImageProbe {
  format: ImageFormat;
  width: number;
  height: number;
}

type Probe = (bytes: Uint8Array, view: DataView) => ImageProbe | null;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_WIDTH_OFFSET = 16;
const PNG_HEIGHT_OFFSET = 20;
const PNG_HEADER_END = 24;

const GIF_SIGNATURES = ["GIF87a", "GIF89a"];
const GIF_WIDTH_OFFSET = 6;
const GIF_HEIGHT_OFFSET = 8;
const GIF_HEADER_END = 10;

const WEBP_CHUNK_OFFSET = 12;
const WEBP_DATA_OFFSET = 20;
const VP8_START_CODE = [0x9d, 0x01, 0x2a];
const VP8_START_CODE_OFFSET = 23;
const VP8_WIDTH_OFFSET = 26;
const VP8_HEIGHT_OFFSET = 28;
const VP8_SIZE_BITS = 0x3fff;
const VP8L_SIGNATURE = 0x2f;
const VP8L_BITS_OFFSET = 21;
const VP8L_DIMENSION_BITS = 14;
const VP8X_WIDTH_OFFSET = 24;
const VP8X_HEIGHT_OFFSET = 27;

const JPEG_SOI = [0xff, 0xd8];
const JPEG_MARKER_PREFIX = 0xff;
const JPEG_FIRST_SEGMENT = 2;
const JPEG_SOF_HEIGHT_OFFSET = 5;
const JPEG_SOF_WIDTH_OFFSET = 7;
/** SOF0–SOF15 중 DHT(C4) · JPG(C8) · DAC(CC)는 프레임 헤더가 아니다 */
const JPEG_NOT_SOF = new Set([0xc4, 0xc8, 0xcc]);
const JPEG_SOF_FIRST = 0xc0;
const JPEG_SOF_LAST = 0xcf;
/** 길이 필드가 없는 마커(TEM · RST0–7) */
const JPEG_STANDALONE = new Set([0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7]);

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function sized(format: ImageFormat, width: number, height: number): ImageProbe | null {
  return width > 0 && height > 0 ? { format, width, height } : null;
}

function u24le(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16);
}

const probePng: Probe = (bytes, view) => {
  if (!startsWith(bytes, PNG_SIGNATURE) || bytes.length < PNG_HEADER_END) return null;
  return sized("png", view.getUint32(PNG_WIDTH_OFFSET), view.getUint32(PNG_HEIGHT_OFFSET));
};

const probeGif: Probe = (bytes, view) => {
  if (!GIF_SIGNATURES.includes(asciiAt(bytes, 0, 6)) || bytes.length < GIF_HEADER_END) return null;
  return sized(
    "gif",
    view.getUint16(GIF_WIDTH_OFFSET, true),
    view.getUint16(GIF_HEIGHT_OFFSET, true),
  );
};

const probeWebp: Probe = (bytes, view) => {
  if (asciiAt(bytes, 0, 4) !== "RIFF" || asciiAt(bytes, 8, 4) !== "WEBP") return null;
  const chunk = asciiAt(bytes, WEBP_CHUNK_OFFSET, 4);
  if (chunk === "VP8 ") {
    if (bytes.length < VP8_HEIGHT_OFFSET + 2) return null;
    if (!startsWith(bytes, VP8_START_CODE, VP8_START_CODE_OFFSET)) return null;
    return sized(
      "webp",
      view.getUint16(VP8_WIDTH_OFFSET, true) & VP8_SIZE_BITS,
      view.getUint16(VP8_HEIGHT_OFFSET, true) & VP8_SIZE_BITS,
    );
  }
  if (chunk === "VP8L") {
    if (bytes.length < VP8L_BITS_OFFSET + 4 || bytes[WEBP_DATA_OFFSET] !== VP8L_SIGNATURE) {
      return null;
    }
    const bits = view.getUint32(VP8L_BITS_OFFSET, true);
    const mask = (1 << VP8L_DIMENSION_BITS) - 1;
    return sized("webp", (bits & mask) + 1, ((bits >>> VP8L_DIMENSION_BITS) & mask) + 1);
  }
  if (chunk === "VP8X") {
    if (bytes.length < VP8X_HEIGHT_OFFSET + 3) return null;
    return sized("webp", u24le(bytes, VP8X_WIDTH_OFFSET) + 1, u24le(bytes, VP8X_HEIGHT_OFFSET) + 1);
  }
  return null;
};

/** 마커를 차례로 건너뛰며 첫 프레임 헤더(SOF)를 찾는다 */
const probeJpeg: Probe = (bytes, view) => {
  if (!startsWith(bytes, JPEG_SOI)) return null;
  let offset = JPEG_FIRST_SEGMENT;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== JPEG_MARKER_PREFIX) return null;
    const marker = bytes[offset + 1] ?? 0;
    // 마커 앞의 채움 0xFF는 건너뛴다
    if (marker === JPEG_MARKER_PREFIX) {
      offset += 1;
      continue;
    }
    if (JPEG_STANDALONE.has(marker)) {
      offset += 2;
      continue;
    }
    const isSof = marker >= JPEG_SOF_FIRST && marker <= JPEG_SOF_LAST && !JPEG_NOT_SOF.has(marker);
    if (isSof) {
      if (offset + JPEG_SOF_WIDTH_OFFSET + 2 > bytes.length) return null;
      return sized(
        "jpeg",
        view.getUint16(offset + JPEG_SOF_WIDTH_OFFSET),
        view.getUint16(offset + JPEG_SOF_HEIGHT_OFFSET),
      );
    }
    const length = view.getUint16(offset + 2);
    // 길이 필드는 자기 2바이트를 포함한다 — 2 미만이면 깨진 파일이고 무한 루프를 막는다
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
};

const PROBES: readonly Probe[] = [probePng, probeGif, probeWebp, probeJpeg];

export function probeImage(bytes: Uint8Array): ImageProbe | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (const probe of PROBES) {
    const found = probe(bytes, view);
    if (found !== null) return found;
  }
  return null;
}
