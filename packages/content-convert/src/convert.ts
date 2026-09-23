import type { Doc } from "@blog-editor/content-schema";

export type ConvertResult =
  { ok: true; doc: Doc; messages: [] } | { ok: false; messages: [string, ...string[]] };

/** markdown(MCP 입력 문법) → 정규형 doc. 실패하면 세 칸 메시지를 전부 모아 돌려준다. */
export function convertMarkdown(markdown: string): ConvertResult {
  void markdown;
  throw new Error("not implemented");
}
