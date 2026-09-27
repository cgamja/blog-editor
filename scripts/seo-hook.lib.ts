/**
 * SEO 훅(이슈 #149) — Claude Code PostToolUse 훅. create_draft · update_draft 직후 저장 응답의 `seo`를 읽어
 * must가 있으면 AI에게 되먹이고(block), should · info는 사람에게 알리기만(notify), 볼 것이 없으면 지나간다(pass).
 *
 * 입출력 근거:
 * - 입력(stdin JSON의 tool_name · tool_input · tool_response): https://code.claude.com/docs/en/hooks#posttooluse-input
 * - block: https://code.claude.com/docs/en/hooks#posttooluse-decision-control — `{"decision":"block","reason"}`의 reason이 Claude에게 간다
 * - notify: https://code.claude.com/docs/en/hooks#json-output — `systemMessage`는 사용자에게 보이는 경고
 * MCP tool_response 모양은 문서가 정하지 않아("depends on the tool") CallToolResult · content 배열 · 파싱된 본문을 모두 받는다.
 *
 * 실행: `node scripts/seo-hook.lib.ts` — 판정(decideSeoHook)과 진입점(main)을 한 파일에 둔다. 진입 파일을 따로 두면
 * `./seo-hook.lib.ts`를 import해야 하는데 루트 tsconfig에 allowImportingTsExtensions가 없고, 확장자 없는 import는
 * node가 찾지 못한다. 그래서 파일 끝의 가드가 node로 직접 실행될 때만 main을 부른다(테스트 import에서는 돌지 않는다).
 */
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** 되먹임 상한 — 같은 글에서 이만큼 block했으면 이후 must는 알리기만 한다(AI가 고치지 못하는 must로 무한 반복하지 않게) */
const MAX_ATTEMPTS = 3;

const DRAFT_TOOLS = {
  create: "mcp__blog-editor__create_draft",
  update: "mcp__blog-editor__update_draft",
} as const;

/** AI가 update_draft 인자로 직접 준 칸 — 그 칸만 걸린 must는 AI가 고른 값이라 되먹여 봐야 같은 값을 다시 고른다 */
const AI_GIVEN_META_FIELDS = ["title", "description", "keyword"] as const;

const MESSAGES = {
  blockHeader:
    "저장한 초안에 검색 노출 필수(must) 항목이 남았어요. 아래를 update_draft로 고쳐 다시 저장하세요.",
  blockFooter: "발행은 하지 마세요 — 발행은 사람이 에디터에서 합니다.",
  capped: `같은 글에 ${MAX_ATTEMPTS}번 되먹였지만 필수(must) 항목이 남았어요. 에디터에서 직접 확인해 주세요.`,
  aiGiven: "AI가 이번에 직접 준 글 정보 칸의 필수(must) 항목이에요. 에디터에서 확인해 주세요.",
  advisory: "저장한 초안의 검색 노출 권장 사항이에요.",
} as const;

const LEVEL_LABEL = { must: "필수", should: "권장", info: "참고" } as const;

type SeoLevel = keyof typeof LEVEL_LABEL;

interface SeoFinding {
  level: SeoLevel;
  rule: string;
  target: { kind: string; field?: string };
  message: string;
  fix: string;
}

export interface HookInput {
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response: unknown;
}

export interface HookState {
  attempts: number;
}

export interface HookDecision {
  action: "block" | "notify" | "pass";
  message: string;
  nextAttempts: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// 오류 문구처럼 JSON이 아닌 text는 저장 응답이 아니다
function parseContent(content: unknown[]): Record<string, unknown> | null {
  const text = content.find(
    (part): part is { type: "text"; text: string } =>
      isRecord(part) && part.type === "text" && typeof part.text === "string",
  )?.text;
  if (text === undefined) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function responseBody(response: unknown): Record<string, unknown> | null {
  if (Array.isArray(response)) return parseContent(response);
  if (!isRecord(response) || response.isError === true) return null;
  if (Array.isArray(response.content)) return parseContent(response.content);
  return response;
}

const isFinding = (value: unknown): value is SeoFinding =>
  isRecord(value) &&
  typeof value.level === "string" &&
  value.level in LEVEL_LABEL &&
  typeof value.message === "string" &&
  typeof value.fix === "string" &&
  isRecord(value.target);

function findingsOf(body: Record<string, unknown> | null): SeoFinding[] {
  if (body === null || !Array.isArray(body.seo)) return [];
  return body.seo.filter(isFinding);
}

function isAboutAiGivenField(finding: SeoFinding, input: HookInput): boolean {
  if (input.tool_name !== DRAFT_TOOLS.update || finding.target.kind !== "meta") return false;
  const field = finding.target.field;
  return (
    AI_GIVEN_META_FIELDS.some((given) => given === field) &&
    field !== undefined &&
    input.tool_input[field] !== undefined
  );
}

const formatFinding = (finding: SeoFinding) =>
  `- [${LEVEL_LABEL[finding.level]}] ${finding.message} → ${finding.fix}`;

const listOf = (findings: SeoFinding[]) => findings.map(formatFinding).join("\n");

export function decideSeoHook(input: HookInput, state: HookState): HookDecision {
  const pass = (nextAttempts: number): HookDecision => ({
    action: "pass",
    message: "",
    nextAttempts,
  });
  const isDraftTool = Object.values(DRAFT_TOOLS).some((name) => name === input.tool_name);
  if (!isDraftTool) return pass(state.attempts);

  const body = responseBody(input.tool_response);
  const findings = findingsOf(body);
  // 점검이 됐고(seo 배열) 지적이 없으면 글이 깨끗해졌다 — 되먹인 횟수를 되돌려 다음 must에 다시 3번을 준다.
  // seo null(점검 실패) · 오류 응답은 판단할 수 없어 횟수를 그대로 둔다
  if (findings.length === 0) return pass(Array.isArray(body?.seo) ? 0 : state.attempts);

  const musts = findings.filter((finding) => finding.level === "must");
  const actionable = musts.filter((finding) => !isAboutAiGivenField(finding, input));
  const notify = (header: string, nextAttempts: number): HookDecision => ({
    action: "notify",
    message: `${header}\n${listOf(findings)}`,
    nextAttempts,
  });

  if (musts.length === 0) return notify(MESSAGES.advisory, 0);
  if (actionable.length === 0) return notify(MESSAGES.aiGiven, state.attempts);
  if (state.attempts >= MAX_ATTEMPTS) return notify(MESSAGES.capped, state.attempts);
  return {
    action: "block",
    message: [MESSAGES.blockHeader, listOf(actionable), MESSAGES.blockFooter].join("\n"),
    nextAttempts: state.attempts + 1,
  };
}

/** 상태 파일 이름으로 쓰므로 주소 모양만 받는다 — 경로 밖으로 나가는 값을 막는다 */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function slugOf(input: HookInput): string | null {
  const candidates = [responseBody(input.tool_response)?.slug, input.tool_input.slug];
  const slug = candidates.find((value): value is string => typeof value === "string");
  return slug !== undefined && SLUG_PATTERN.test(slug) ? slug : null;
}

function stateDir(): string {
  return join(process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), ".claude", "state", "seo-hook");
}

function readState(file: string): HookState {
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    const attempts = isRecord(parsed) ? parsed.attempts : undefined;
    // 손상된 값(음수 · 소수)으로 상한을 비켜 가지 않게 0 이상 정수만 받는다
    return {
      attempts: Number.isInteger(attempts) && (attempts as number) >= 0 ? (attempts as number) : 0,
    };
  } catch (error) {
    // 파일이 없으면 처음이다. 그 밖의 읽기 오류는 기록만 하고 처음부터 센다(훅이 작업을 막지 않게)
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      process.stderr.write(`seo-hook: 상태 파일을 읽지 못해 처음부터 센다 — ${String(error)}\n`);
    }
    return { attempts: 0 };
  }
}

function output(decided: HookDecision): string | null {
  if (decided.action === "block")
    return JSON.stringify({ decision: "block", reason: decided.message });
  if (decided.action === "notify") return JSON.stringify({ systemMessage: decided.message });
  return null;
}

function main(): void {
  try {
    const parsed: unknown = JSON.parse(readFileSync(0, "utf8"));
    if (!isRecord(parsed) || typeof parsed.tool_name !== "string") return;
    const input: HookInput = {
      tool_name: parsed.tool_name,
      tool_input: isRecord(parsed.tool_input) ? parsed.tool_input : {},
      tool_response: parsed.tool_response,
    };
    const slug = slugOf(input);
    const file = slug === null ? null : join(stateDir(), `${slug}.json`);
    const state = file === null ? { attempts: 0 } : readState(file);
    const decided = decideSeoHook(input, state);
    const out = output(decided);
    if (out !== null) process.stdout.write(`${out}\n`);
    if (file !== null && decided.nextAttempts !== state.attempts) {
      mkdirSync(stateDir(), { recursive: true });
      writeFileSync(file, JSON.stringify({ attempts: decided.nextAttempts }));
    }
  } catch (error) {
    // 훅이 작업을 막지 않게 삼킨다 — 원인만 한 줄 남긴다
    process.stderr.write(`seo-hook: ${error instanceof Error ? error.message : String(error)}\n`);
  }
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  realpathSync(invokedPath) === realpathSync(fileURLToPath(import.meta.url))
) {
  main();
}
