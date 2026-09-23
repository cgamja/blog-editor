import { docSchema, normalize } from "@blog-editor/content-schema";
import type { Doc } from "@blog-editor/content-schema";
import { analyzeTokens } from "./check";
import { resolveDirectives, stripDirectiveLines } from "./directives";
import { docMessage, sortMessages } from "./message";
import { buildDoc } from "./parser";
import { createMarkdownIt } from "./tokens";

export type ConvertResult =
  { ok: true; doc: Doc; messages: [] } | { ok: false; messages: [string, ...string[]] };

function fail(messages: string[]): ConvertResult {
  const [first, ...rest] = messages;
  if (first === undefined) {
    // 호출자가 항상 메시지를 하나 이상 모아 부르므로 실제로는 닿지 않는다 — 타입만 지킨다.
    return {
      ok: false,
      messages: ['문서 (1줄): 알 수 없는 오류로 변환에 실패했다(받음: "") → 다시 시도한다'],
    };
  }
  return { ok: false, messages: [first, ...rest] };
}

const markdownIt = createMarkdownIt();

/** markdown(MCP 입력 문법) → 정규형 doc. 실패하면 세 칸 메시지를 전부 모아 돌려준다. */
export function convertMarkdown(markdown: string): ConvertResult {
  try {
    if (typeof markdown !== "string") {
      return fail([docMessage(1, "본문이 비어 있다", "", "문단 하나 이상을 쓴다").text]);
    }
    if (markdown.trim() === "") {
      return fail([docMessage(1, "본문이 비어 있다", "", "문단 하나 이상을 쓴다").text]);
    }

    const { strippedText, lines, candidates } = stripDirectiveLines(markdown);
    const tokens = markdownIt.parse(strippedText, {});
    const { registry, messages: structuralMessages } = analyzeTokens(tokens, lines);
    const { resolvedByMapStart, messages: directiveMessages } = resolveDirectives(
      candidates,
      lines,
      registry,
    );

    const found = [...structuralMessages, ...directiveMessages];
    if (found.length > 0) {
      return fail(sortMessages(found));
    }

    const topLevelRecords = registry.filter((r) => r.container === "top");
    const rawDoc = buildDoc(strippedText, topLevelRecords, resolvedByMapStart);
    const parsedDoc = docSchema.safeParse(rawDoc);
    if (!parsedDoc.success) {
      // stage 1이 전부 걸렀다면 여기 닿지 않는다(adr-013) — 닿으면 내부 오류로 취급한다.
      throw new Error(`변환 결과가 docSchema를 통과하지 못했다: ${parsedDoc.error.message}`);
    }

    return { ok: true, doc: normalize(parsedDoc.data), messages: [] };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return fail([
      docMessage(
        1,
        "변환 중 내부 오류가 났다",
        reason.slice(0, 200),
        "markdown을 확인해 다시 시도한다",
      ).text,
    ]);
  }
}
