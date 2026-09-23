import { z } from "zod";

/**
 * 실제 정의(노드 · 마크 · 꾸미기 · href/이미지 허용 목록 · 스티커 합계 12)는 1.2 구현 과제.
 * 지금은 계약(타입 · export 이름)만 있고 호출하면 던진다 — 테스트가 "모듈 없음"이 아니라
 * "기능 미구현"으로 빨강이 되게 하기 위해서다(1.1 verify 조건).
 */
export type Mark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "code" }
  | { type: "link"; attrs: { href: string } };

export type Sticker = { id: string; x: number; y: number; size: number; rotate: number };

export type DecorationAttrs = {
  font?: string;
  motion?: string;
  width?: number;
  stickers?: Sticker[];
};

export type TextNode = { type: "text"; text: string; marks?: Mark[] };

/** 최상위 블록 · 안쪽 노드(listItem)를 함께 담는 느슨한 타입 — 실제 판별은 zod가 한다 */
export type Block = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: unknown[];
  text?: string;
  marks?: Mark[];
};

export type Doc = { type: "doc"; content: Block[] };

function notImplemented(): never {
  throw new Error("docSchema: 기능 미구현");
}

/**
 * 1.2에서 실제 zod 스키마로 교체한다. 지금은 parse/safeParse 둘 다 호출 즉시 던지는 자리표시자 —
 * z.custom을 안 쓰는 이유는 safeParse가 내부적으로 ZodError만 삼키고 일반 Error는 그대로
 * 올려보내는지가 zod 버전마다 달라 신뢰할 수 없어서다. 여기서는 대신 아예 zod를 거치지 않고
 * 직접 던지므로 parse/safeParse 둘 다 항상 던진다는 게 보장된다.
 */
export const docSchema = {
  parse: notImplemented,
  safeParse: notImplemented,
} as unknown as z.ZodType<Doc>;
