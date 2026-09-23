import { referenceTitleMessage, unusedReferenceMessage, type FoundMessage } from "./message";

/** markdown-it이 `state.env`에 채우는 링크 참조 정의 — `md.parse(text, env)`로 넘기는 그릇. */
export interface MarkdownEnv {
  references?: Record<string, { title: string; href: string }>;
}

/** `[label]: url "title"` 모양 — 각주 정의(`[^label]:`)는 directives.ts가 먼저 걷어내 여기 안 온다. */
const REFERENCE_DEFINITION_LINE = /^ {0,3}\[([^\]]+)\]:/;

/**
 * 링크 참조 정의는 실제로 쓰였으면(spec 결정, 2026-09-23) 인라인 링크와 똑같이 받는다 — href
 * 검사는 그 사용처의 link_open 토큰에서 이미 끝난다(check.ts). 여기서는 정의 자체만 본다: title이
 * 있으면(링크 title처럼) 거부하고, 아무 데서도 안 쓴 정의는 거부한다(빈 doc 자리를 차지한다).
 */
export function checkReferenceDefinitions(
  lines: readonly string[],
  env: MarkdownEnv,
  usedHrefs: ReadonlySet<string>,
  normalizeReference: (label: string) => string,
): FoundMessage[] {
  const references = env.references;
  if (!references) return [];

  const lineByLabel = new Map<string, number>();
  for (let i = 0; i < lines.length; i++) {
    const match = REFERENCE_DEFINITION_LINE.exec(lines[i]!);
    if (!match) continue;
    const label = normalizeReference(match[1]!);
    if (!lineByLabel.has(label)) lineByLabel.set(label, i + 1);
  }

  const messages: FoundMessage[] = [];
  for (const [label, ref] of Object.entries(references)) {
    const line = lineByLabel.get(label) ?? 1;
    const raw = lines[line - 1]?.trim() ?? "";
    if (ref.title !== "") {
      messages.push(referenceTitleMessage(line, raw));
      continue;
    }
    if (!usedHrefs.has(ref.href)) {
      messages.push(unusedReferenceMessage(line, raw));
    }
  }
  return messages;
}
