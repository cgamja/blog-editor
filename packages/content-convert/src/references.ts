import type MarkdownIt from "markdown-it";
import { computeFenceMask } from "./fence";
import {
  duplicateReferenceLabelMessage,
  footnoteDefinitionMessage,
  referenceTitleMessage,
  unusedReferenceMessage,
  type FoundMessage,
} from "./message";
import type { MarkdownEnv } from "./types";

/** `[label]: url "title"` 모양 — 앞에 `>`(인용)·공백(목록 들여쓰기) 접두사를 허용한다. 각주 정의
 * (`[^label]:`)도 문법상 이 모양이라 여기 걸린다 — footnote로 따로 거부하는 건 checkReferenceDefinitions다. */
const REFERENCE_DEFINITION_LINE = /^(?:[ \t]*>[ \t]?)*[ \t]*\[([^\]]+)\]:\s*(.*)$/;

/**
 * markdown-it이 참조를 실제로 resolve할 때만(link · image 인라인 규칙이 `env.references[label]`을
 * 읽을 때만) "라벨을 썼다"로 센다 — env.references에 Proxy를 씌워 get을 가로챈다. block 단계(참조
 * 정의 자체를 등록할 때의 중복 검사 읽기)는 이 Proxy가 붙기 전에 끝나므로 섞이지 않는다: markdown-it
 * core 체인은 'block'이 전부 끝난 뒤에만 'inline'을 돈다(parser_core.mjs).
 *
 * 원본 정의 테이블은 `env.referenceDefinitions`에 그대로 남겨 둔다 — checkReferenceDefinitions가
 * 나중에(파싱이 다 끝난 뒤) 그걸 순회할 때 Proxy의 get에 다시 걸려 "다 쓴 것"으로 잘못 세지 않게
 * 하려는 것이다.
 */
export function attachReferenceUsageTracking(md: MarkdownIt): void {
  md.core.ruler.after("block", "track_reference_usage", (state) => {
    const env = state.env as MarkdownEnv;
    const definitions = env.references;
    if (!definitions) return;

    env.referenceDefinitions = definitions;
    const used = new Set<string>();
    env.usedReferenceLabels = used;
    env.references = new Proxy(definitions, {
      get(target, prop, receiver) {
        if (typeof prop === "string" && Object.prototype.hasOwnProperty.call(target, prop)) {
          used.add(prop);
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  });
}

/**
 * 정규화한 라벨 → 그 라벨이 정의된 모든 줄(1부터, 등장 순). 코드 펜스 안은 걷어낸다(fence.ts 공유) —
 * 거기 적힌 `[label]:` 모양은 그냥 코드 글자지 정의가 아니다. 첫 줄이 markdown-it이 채택하는 정의고
 * (env.references는 첫 정의만 남긴다), 그 뒤는 전부 "같은 라벨 중복 정의"로 거부한다.
 */
function collectDefinitionLines(
  lines: readonly string[],
  normalizeReference: (label: string) => string,
): Map<string, number[]> {
  const fenceMask = computeFenceMask(lines);
  const linesByLabel = new Map<string, number[]>();
  for (let i = 0; i < lines.length; i++) {
    if (fenceMask[i]) continue;
    const match = REFERENCE_DEFINITION_LINE.exec(lines[i]!);
    if (!match) continue;
    const label = normalizeReference(match[1]!);
    const occurrences = linesByLabel.get(label);
    if (occurrences) occurrences.push(i + 1);
    else linesByLabel.set(label, [i + 1]);
  }
  return linesByLabel;
}

/**
 * 링크 참조 정의는 실제로 쓰였으면(spec 결정, 2026-09-23) 인라인 링크와 똑같이 받는다 — href
 * 검사는 그 사용처의 link_open 토큰에서 이미 끝난다(check.ts). 여기서는 정의 자체만 본다:
 *
 * - 라벨이 `^`로 시작하면(각주 모양, `[^1]: …`) 위치(인용 · 깊은 목록 안 포함)와 무관하게 각주로
 *   거부한다 — 최상위 각주 정의는 이미 directives.ts가 파싱 전에 걷어내지만, 인용 · 목록 안에 있으면
 *   markdown-it이 평범한 참조 정의로 착각해 여기까지 살아남는다.
 * - title이 있으면(링크 title처럼) 거부한다.
 * - "쓰였다"는 라벨로 본다(href로 보면 href가 우연히 같은 다른 링크와 안 쓰인 정의를 혼동한다 — 리뷰
 *   2026-09-23). 아무 데서도 안 쓴 정의는 거부한다(빈 doc 자리를 차지한다).
 * - 같은 라벨을 두 번 정의하면 markdown-it은 첫 정의만 쓰므로 그 뒤 정의를 여기서 따로 거부한다.
 */
export function checkReferenceDefinitions(
  lines: readonly string[],
  env: MarkdownEnv,
  normalizeReference: (label: string) => string,
): FoundMessage[] {
  const definitions = env.referenceDefinitions;
  if (!definitions) return [];
  const usedLabels = env.usedReferenceLabels ?? new Set<string>();
  const linesByLabel = collectDefinitionLines(lines, normalizeReference);

  const messages: FoundMessage[] = [];
  for (const [label, ref] of Object.entries(definitions)) {
    const occurrences = linesByLabel.get(label) ?? [];
    const [firstLine, ...duplicateLines] = occurrences;
    const line = firstLine ?? 1;
    const raw = lines[line - 1]?.trim() ?? `[${label}]: ${ref.href}`;

    for (const duplicateLine of duplicateLines) {
      const duplicateRaw = lines[duplicateLine - 1]?.trim() ?? `[${label}]: ${ref.href}`;
      messages.push(duplicateReferenceLabelMessage(duplicateLine, duplicateRaw));
    }

    if (label.startsWith("^")) {
      messages.push(footnoteDefinitionMessage(line, raw));
      continue;
    }
    if (ref.title !== "") {
      messages.push(referenceTitleMessage(line, raw));
      continue;
    }
    if (!usedLabels.has(label)) {
      messages.push(unusedReferenceMessage(line, raw));
    }
  }
  return messages;
}

/**
 * title이 있고 실제로 쓰인 참조 정의의 href — check.ts의 인라인 링크 title 검사가 이 집합에 든
 * href는 건너뛴다. 참조로 resolve된 link_open 토큰도 title 속성을 그대로 갖기 때문에(markdown-it
 * link.mjs), checkReferenceDefinitions가 정의 줄에서 이미 거부한 title을 사용처에서 또 거부하면
 * 메시지가 중복된다(finding 5) — 참조 정의 쪽이 "원인 있는 곳"이라 거기서만 한 번 알린다.
 */
export function referencedTitledHrefs(env: MarkdownEnv): ReadonlySet<string> {
  const definitions = env.referenceDefinitions;
  const used = env.usedReferenceLabels;
  if (!definitions || !used) return new Set();
  const hrefs = new Set<string>();
  for (const label of used) {
    const ref = definitions[label];
    if (ref && ref.title !== "") hrefs.add(ref.href);
  }
  return hrefs;
}
