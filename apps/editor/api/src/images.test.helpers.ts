/**
 * 이미지 헤더 바이트 만들기 — image-probe · images 두 테스트 파일이 같이 쓴다(adr/0034 ③).
 * 헤더만 만든다. 서버는 헤더만 보므로(ADR-021) 나머지 바이트는 채움이다.
 */

const PAD = 64;

function bytes(length: number): Uint8Array {
  return new Uint8Array(length);
}

function ascii(target: Uint8Array, offset: number, text: string): void {
  for (let index = 0; index < text.length; index += 1) {
    target[offset + index] = text.charCodeAt(index);
  }
}

const view = (target: Uint8Array) => new DataView(target.buffer);

/** 채움 바이트 수를 바꿔 같은 크기 다른 내용(다른 해시)을 만들 수 있다 */
export function pngBytes(width: number, height: number, padding = PAD): Uint8Array {
  const out = bytes(33 + padding);
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  view(out).setUint32(8, 13);
  ascii(out, 12, "IHDR");
  view(out).setUint32(16, width);
  view(out).setUint32(20, height);
  return out;
}

export function gifBytes(width: number, height: number): Uint8Array {
  const out = bytes(13 + PAD);
  ascii(out, 0, "GIF89a");
  view(out).setUint16(6, width, true);
  view(out).setUint16(8, height, true);
  return out;
}

function riffWebp(chunk: string, body: Uint8Array): Uint8Array {
  const out = bytes(20 + body.length);
  ascii(out, 0, "RIFF");
  view(out).setUint32(4, out.length - 8, true);
  ascii(out, 8, "WEBP");
  ascii(out, 12, chunk);
  view(out).setUint32(16, body.length, true);
  out.set(body, 20);
  return out;
}

/** 손실 WebP — 프레임 헤더의 시작 코드 뒤 14비트 가로 · 세로 */
export function webpVp8Bytes(width: number, height: number): Uint8Array {
  const body = bytes(10 + PAD);
  body.set([0x9d, 0x01, 0x2a], 3);
  view(body).setUint16(6, width, true);
  view(body).setUint16(8, height, true);
  return riffWebp("VP8 ", body);
}

/** 무손실 WebP — 서명 0x2f 뒤 14비트씩(값 - 1) */
export function webpVp8lBytes(width: number, height: number): Uint8Array {
  const body = bytes(5 + PAD);
  body[0] = 0x2f;
  const packed = (width - 1) | ((height - 1) << 14);
  view(body).setUint32(1, packed >>> 0, true);
  return riffWebp("VP8L", body);
}

/** 확장 WebP — 캔버스 가로 · 세로 24비트(값 - 1) */
export function webpVp8xBytes(width: number, height: number): Uint8Array {
  const body = bytes(10 + PAD);
  const w = width - 1;
  const h = height - 1;
  body.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff], 4);
  body.set([h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 7);
  return riffWebp("VP8X", body);
}

/** SOI → APP0(길이 16) → SOF0 — 앞의 APP 마커를 건너뛰는 경로까지 지난다 */
export function jpegBytes(width: number, height: number): Uint8Array {
  const out = bytes(2 + 18 + 19 + PAD);
  out.set([0xff, 0xd8], 0);
  out.set([0xff, 0xe0], 2);
  view(out).setUint16(4, 16);
  ascii(out, 6, "JFIF");
  const sof = 20;
  out.set([0xff, 0xc0], sof);
  view(out).setUint16(sof + 2, 17);
  out[sof + 4] = 8;
  view(out).setUint16(sof + 5, height);
  view(out).setUint16(sof + 7, width);
  return out;
}

type ByteOrder = "MM" | "II";

interface ExifOptions {
  order?: ByteOrder;
  /** IFD0 오프셋을 망가뜨려 경계 검사를 본다 */
  ifdOffset?: number;
  /** IFD 엔트리 수를 망가뜨려 경계 검사를 본다 */
  entryCount?: number;
}

/** 마커 + 길이(u16 BE, 자기 2바이트 포함) + 내용 */
function segment(marker: number, payload: Uint8Array): Uint8Array {
  const out = bytes(4 + payload.length);
  out.set([0xff, marker], 0);
  view(out).setUint16(2, payload.length + 2);
  out.set(payload, 4);
  return out;
}

/**
 * APP1 Exif — TIFF 머리(바이트 순서 · 42 · IFD0 오프셋 8) + IFD0에 Orientation 한 칸(0x0112 · SHORT · 1개).
 * https://www.cipa.jp/std/documents/e/DC-X008-Translation-2019-E.pdf 4.5 · 4.6.4
 */
export function exifApp1(orientation: number, options: ExifOptions = {}): Uint8Array {
  const { order = "MM", ifdOffset = 8, entryCount = 1 } = options;
  const little = order === "II";
  const payload = bytes(6 + 8 + 2 + 12 + 4);
  ascii(payload, 0, "Exif");
  const tiff = 6;
  const v = view(payload);
  ascii(payload, tiff, order);
  v.setUint16(tiff + 2, 42, little);
  v.setUint32(tiff + 4, ifdOffset, little);
  v.setUint16(tiff + 8, entryCount, little);
  v.setUint16(tiff + 10, 0x0112, little);
  v.setUint16(tiff + 12, 3, little);
  v.setUint32(tiff + 14, 1, little);
  v.setUint16(tiff + 18, orientation, little);
  return segment(0xe1, payload);
}

/** APP1 XMP — Exif가 아닌 APP1(같은 마커)을 건너뛰는지 본다 */
export function xmpApp1(): Uint8Array {
  return segment(0xe1, new TextEncoder().encode("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>"));
}

export function sof0(width: number, height: number): Uint8Array {
  const payload = bytes(15);
  payload[0] = 8;
  view(payload).setUint16(1, height);
  view(payload).setUint16(3, width);
  return segment(0xc0, payload);
}

/** SOS — 뒤는 엔트로피 코딩 데이터라 헤더 판정은 여기서 멈춘다 */
export function sos(): Uint8Array {
  return segment(0xda, bytes(10));
}

/** SOI 뒤에 세그먼트들을 순서대로 잇고 채움 바이트를 붙인다 */
export function jpegFrom(...segments: Uint8Array[]): Uint8Array {
  const total = 2 + segments.reduce((sum, part) => sum + part.length, 0) + PAD;
  const out = bytes(total);
  out.set([0xff, 0xd8], 0);
  let offset = 2;
  for (const part of segments) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** SOI → APP1(Exif) → SOF0 → SOS */
export function jpegWithOrientationBytes(
  width: number,
  height: number,
  orientation: number,
  order: ByteOrder = "MM",
): Uint8Array {
  return jpegFrom(exifApp1(orientation, { order }), sof0(width, height), sos());
}

export function svgBytes(): Uint8Array {
  return new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
  );
}
