import { docSchema, normalize } from "@blog-editor/content-schema";
import type { Doc } from "@blog-editor/content-schema";
import { analyzeTokens } from "./check";
import { resolveDirectives, stripDirectiveLines } from "./directives";
import { docMessage, emptyDocumentMessage, internalErrorMessage, sortMessages } from "./message";
import { buildDoc } from "./parser";
import {
  attachReferenceUsageTracking,
  checkReferenceDefinitions,
  referencedTitledHrefs,
} from "./references";
import { createMarkdownIt } from "./tokens";
import type { MarkdownEnv } from "./types";

export type ConvertResult =
  { ok: true; doc: Doc; messages: [] } | { ok: false; messages: [string, ...string[]] };

function fail(messages: string[]): ConvertResult {
  const [first, ...rest] = messages;
  if (first === undefined) {
    // 호출자가 항상 메시지를 하나 이상 모아 부르므로 실제로는 닿지 않는다 — 타입만 지킨다.
    return {
      ok: false,
      messages: [docMessage(1, "알 수 없는 오류로 변환에 실패했다", "", "다시 시도한다").text],
    };
  }
  return { ok: false, messages: [first, ...rest] };
}

const markdownIt = createMarkdownIt();
attachReferenceUsageTracking(markdownIt);

/** 선행 BOM을 지우고 `\r\n`·`\r`을 `\n`으로 맞춘다 — 그 뒤 모든 줄 번호 계산이 이 기준이다. */
function normalizeInput(markdown: string): string {
  const withoutBom = markdown.startsWith("﻿") ? markdown.slice(1) : markdown;
  return withoutBom.replace(/\r\n?/g, "\n");
}

/** markdown(MCP 입력 문법) → 정규형 doc. 실패하면 세 칸 메시지를 전부 모아 돌려준다. */
export function convertMarkdown(markdown: string): ConvertResult {
  try {
    if (typeof markdown !== "string" || markdown.trim() === "") {
      return fail([emptyDocumentMessage().text]);
    }

    const normalized = normalizeInput(markdown);
    const { strippedText, lines, candidates, footnoteMessages } = stripDirectiveLines(normalized);
    const env: MarkdownEnv = {};
    const tokens = markdownIt.parse(strippedText, env);
    const titledReferenceHrefs = referencedTitledHrefs(env);
    const { registry, messages: structuralMessages } = analyzeTokens(
      tokens,
      lines,
      titledReferenceHrefs,
    );
    const { resolvedByMapStart, messages: directiveMessages } = resolveDirectives(
      candidates,
      lines,
      registry,
    );
    const referenceMessages = checkReferenceDefinitions(
      lines,
      env,
      markdownIt.utils.normalizeReference,
    );

    const found = [
      ...footnoteMessages,
      ...structuralMessages,
      ...directiveMessages,
      ...referenceMessages,
    ];
    if (found.length > 0) {
      return fail(sortMessages(found));
    }

    const topLevelRecords = registry.filter((r) => r.container === "top");
    const rawDoc = buildDoc(strippedText, topLevelRecords, resolvedByMapStart);
    const parsedDoc = docSchema.safeParse(rawDoc);
    if (!parsedDoc.success) {
      // stage 1이 전부 걸렀다면 여기 닿지 않는다(adr-013) — 닿으면 내부 오류로 취급한다.
      const firstIssue = parsedDoc.error.issues[0];
      const detail = firstIssue
        ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
        : parsedDoc.error.message;
      throw new Error(`변환 결과가 docSchema를 통과하지 못했다: ${detail}`);
    }

    return { ok: true, doc: normalize(parsedDoc.data), messages: [] };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return fail([internalErrorMessage(reason).text]);
  }
}
