import type Token from "markdown-it/lib/token.mjs";
import {
  ALT_MAX_LENGTH,
  CALLOUT_TONES,
  HEADING_LEVELS,
  hrefSchema,
  imagePathSchema,
} from "@blog-editor/content-schema";
import { blockMessage, docMessage, type FoundMessage } from "./message";
import type { BlockRecord, ContainerKind, SemanticType } from "./types";

/** 소문자로 시작, 소문자·숫자·`+#.`만 — docSchema의 CODE_LANGUAGE_PATTERN과 같은 규칙(비공개 상수라 여기서 다시 정의). */
const CODE_LANGUAGE_PATTERN = /^[a-z][a-z0-9+#.]*$/;

const ALLOWED_IN: Record<ContainerKind, ReadonlySet<SemanticType>> = {
  blockquote: new Set(["paragraph"]),
  listItem: new Set(["paragraph", "bulletList", "orderedList"]),
  callout: new Set(["paragraph", "bulletList", "orderedList"]),
};

const CONTAINER_LABEL: Record<ContainerKind, string> = {
  blockquote: "인용",
  listItem: "목록",
  callout: "콜아웃",
};

export interface AnalyzeResult {
  registry: BlockRecord[];
  messages: FoundMessage[];
}

/** `:::` 닫는 줄인가 — 인용(`>`) · 목록(들여쓰기) 안의 콜아웃도 있어 그 접두사를 먼저 벗긴다. */
function isClosingLine(line: string | undefined): boolean {
  if (line === undefined) return false;
  const stripped = line.replace(/^(?:[ \t]*>[ \t]?)*[ \t]*/, "");
  return /^:{3,}[ \t]*$/.test(stripped);
}

/** container_callout_open의 info("callout" 또는 "callout tone=xxx")에서 tone을 뽑는다. */
export function parseCalloutTone(info: string): { invalid: boolean; value: string } {
  const rest = info
    .trim()
    .replace(/^callout\s*/, "")
    .trim();
  if (rest === "") return { invalid: false, value: "note" };
  const match = /^tone=(\S+)$/.exec(rest);
  if (!match) return { invalid: true, value: rest };
  const tone = match[1]!;
  if (!(CALLOUT_TONES as readonly string[]).includes(tone)) return { invalid: true, value: tone };
  return { invalid: false, value: tone };
}

function mapOf(tok: Token): [number, number] {
  return tok.map ?? [0, 0];
}

/**
 * 토큰을 한 번 훑어 (1) 최상위 · 안쪽 블록 레지스트리와 (2) 정의 밖 · 자리 밖 오류 메시지를 같이
 * 만든다(adr-013 ①). 여기서 오류가 하나라도 나오면 prosemirror-markdown은 절대 부르지 않는다 —
 * 스키마에 안 맞는 토큰을 오류 없이 버리기 때문이다(스파이크 #2).
 */
export function analyzeTokens(
  tokens: readonly Token[],
  sourceLines: readonly string[],
): AnalyzeResult {
  const registry: BlockRecord[] = [];
  const messages: FoundMessage[] = [];
  const stack: ContainerKind[] = [];
  let topLevel = 0;
  let currentBlock: BlockRecord | undefined;

  const container = (): "top" | ContainerKind =>
    stack.length === 0 ? "top" : stack[stack.length - 1]!;

  function openRecord(semantic: SemanticType, mapStart0: number, mapEnd0: number): BlockRecord {
    const parentKind = container();
    if (parentKind === "top") topLevel += 1;
    const record: BlockRecord = { mapStart0, mapEnd0, semantic, container: parentKind, topLevel };
    registry.push(record);
    if (parentKind !== "top" && !ALLOWED_IN[parentKind].has(semantic)) {
      const allowedText = parentKind === "blockquote" ? "문단만" : "문단 · 목록만";
      messages.push(
        blockMessage(
          record.topLevel,
          mapStart0 + 1,
          `${CONTAINER_LABEL[parentKind]} 안에는 ${allowedText} 쓴다`,
          sourceLines[mapStart0] ?? "",
          `${CONTAINER_LABEL[parentKind]} 밖으로 옮긴다`,
        ),
      );
    }
    return record;
  }

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    switch (tok.type) {
      case "paragraph_open": {
        const next = tokens[i + 1];
        const soleChild =
          next?.type === "inline" && next.children?.length === 1 ? next.children[0] : undefined;
        const semantic: SemanticType = soleChild?.type === "image" ? "image" : "paragraph";
        currentBlock = openRecord(semantic, mapOf(tok)[0], mapOf(tok)[1]);
        break;
      }
      case "heading_open": {
        const [start] = mapOf(tok);
        const record = openRecord("heading", start, mapOf(tok)[1]);
        currentBlock = record;
        const level = Number(tok.tag.slice(1));
        if (!(HEADING_LEVELS as readonly number[]).includes(level)) {
          const text = tokens[i + 1]?.content ?? "";
          messages.push(
            blockMessage(
              record.topLevel,
              start + 1,
              "제목은 ##·###만 쓴다",
              sourceLines[start] ?? "",
              `"## ${text}"`,
            ),
          );
        }
        break;
      }
      case "blockquote_open":
        openRecord("blockquote", mapOf(tok)[0], mapOf(tok)[1]);
        stack.push("blockquote");
        break;
      case "blockquote_close":
        stack.pop();
        break;
      case "bullet_list_open":
        openRecord("bulletList", mapOf(tok)[0], mapOf(tok)[1]);
        break;
      case "bullet_list_close":
        break;
      case "ordered_list_open": {
        const [start, end] = mapOf(tok);
        const record = openRecord("orderedList", start, end);
        const startAttr = tok.attrGet("start");
        if (startAttr !== null && Number(startAttr) !== 1) {
          messages.push(
            blockMessage(
              record.topLevel,
              start + 1,
              "순서 목록은 1부터 시작한다",
              sourceLines[start] ?? "",
              "번호를 1부터 다시 매긴다",
            ),
          );
        }
        break;
      }
      case "ordered_list_close":
        break;
      case "list_item_open":
        stack.push("listItem");
        break;
      case "list_item_close":
        stack.pop();
        break;
      case "fence":
      case "code_block": {
        const [start, end] = mapOf(tok);
        const record = openRecord("codeBlock", start, end);
        const lang = tok.type === "fence" ? tok.info.trim() : "";
        if (lang !== "" && !CODE_LANGUAGE_PATTERN.test(lang)) {
          messages.push(
            blockMessage(
              record.topLevel,
              start + 1,
              "코드 언어는 소문자로 시작하는 소문자 · 숫자 · +#.만 쓴다(-는 안 된다)",
              lang,
              "ts",
            ),
          );
        }
        break;
      }
      case "hr": {
        const [start, end] = mapOf(tok);
        openRecord("horizontalRule", start, end);
        break;
      }
      case "table_open": {
        const [start, end] = mapOf(tok);
        const record = openRecord("paragraph", start, end);
        messages.push(
          blockMessage(
            record.topLevel,
            start + 1,
            "표는 정의 밖이다",
            sourceLines[start] ?? "",
            "표 대신 목록이나 문단으로 쓴다",
          ),
        );
        break;
      }
      case "html_block": {
        const [start, end] = mapOf(tok);
        const record = openRecord("paragraph", start, end);
        messages.push(
          blockMessage(
            record.topLevel,
            start + 1,
            "HTML 태그는 정의 밖이다",
            sourceLines[start] ?? "",
            "HTML 태그를 지운다",
          ),
        );
        break;
      }
      case "container_callout_open": {
        const [start, end] = mapOf(tok);
        const raw = sourceLines[start] ?? "";
        const closed = isClosingLine(sourceLines[end]);
        if (!closed) {
          messages.push(docMessage(start + 1, "콜아웃이 닫히지 않았다", raw, '끝에 ":::" 줄 추가'));
        }
        const record = openRecord("callout", start, end);
        stack.push("callout");
        const isEmpty = tokens[i + 1]?.type === "container_callout_close";
        if (isEmpty && closed) {
          messages.push(
            blockMessage(
              record.topLevel,
              start + 1,
              "콜아웃 안에는 내용이 있어야 한다",
              raw,
              "문단이나 목록을 하나 이상 쓴다",
            ),
          );
        }
        const tone = parseCalloutTone(tok.info);
        if (tone.invalid) {
          messages.push(
            blockMessage(
              record.topLevel,
              start + 1,
              "콜아웃 tone은 note · tip · warning만 쓴다",
              tone.value,
              ":::callout tone=tip",
            ),
          );
        }
        break;
      }
      case "container_callout_close":
        stack.pop();
        break;
      case "inline":
        checkInline(tok, currentBlock, sourceLines, messages);
        break;
      default:
        break;
    }
  }

  return { registry, messages };
}

function checkInline(
  tok: Token,
  block: BlockRecord | undefined,
  sourceLines: readonly string[],
  messages: FoundMessage[],
): void {
  if (!block) return;
  const children = tok.children ?? [];
  const line = block.mapStart0 + 1;
  const raw = sourceLines[block.mapStart0] ?? "";

  for (const child of children) {
    switch (child.type) {
      case "hardbreak":
        messages.push(
          blockMessage(
            block.topLevel,
            line,
            "줄 끝 공백 둘이나 \\로 강제 줄바꿈은 쓸 수 없다",
            raw,
            "문단을 그대로 잇거나(공백 하나) 새 문단으로 나눈다",
          ),
        );
        break;
      case "s_open":
        messages.push(
          blockMessage(block.topLevel, line, "취소선(~~)은 정의 밖이다", raw, "취소선을 지운다"),
        );
        break;
      case "html_inline":
        messages.push(
          blockMessage(
            block.topLevel,
            line,
            "HTML 태그는 정의 밖이다",
            child.content,
            "HTML 태그를 지운다",
          ),
        );
        break;
      case "link_open": {
        const href = child.attrGet("href") ?? "";
        const title = child.attrGet("title");
        if (title !== null) {
          messages.push(
            blockMessage(
              block.topLevel,
              line,
              "링크의 title은 쓸 수 없다",
              title,
              "title을 지운다",
            ),
          );
        }
        if (!hrefSchema.safeParse(href).success) {
          messages.push(
            blockMessage(
              block.topLevel,
              line,
              "링크는 http(s) · mailto · 내부 경로만",
              href,
              '"[글자](https://example.com)"',
            ),
          );
        }
        break;
      }
      case "image": {
        const src = child.attrGet("src") ?? "";
        const alt = child.content;
        const title = child.attrGet("title");
        if (title !== null) {
          messages.push(
            blockMessage(
              block.topLevel,
              line,
              "이미지의 title은 쓸 수 없다",
              title,
              "title을 지운다",
            ),
          );
        }
        if (!imagePathSchema.safeParse(src).success) {
          messages.push(
            blockMessage(
              block.topLevel,
              line,
              "이미지는 /images/<이름>.<확장자> 경로만",
              src,
              '이미지 줄을 지우고 사람에게 업로드를 요청한다. 이미 올린 "/images/…" 경로만 쓸 수 있다',
            ),
          );
        }
        if (alt.length > ALT_MAX_LENGTH) {
          messages.push(
            blockMessage(
              block.topLevel,
              line,
              `대체 글자는 ${ALT_MAX_LENGTH}자 이내로 쓴다`,
              alt,
              "대체 글자를 줄인다",
            ),
          );
        }
        if (children.length !== 1) {
          messages.push(
            blockMessage(
              block.topLevel,
              line,
              "이미지는 글자와 섞을 수 없다",
              raw,
              "이미지만 있는 문단으로 따로 쓴다",
            ),
          );
        } else if (block.container !== "top") {
          messages.push(
            blockMessage(
              block.topLevel,
              line,
              "이미지는 최상위 블록에서만 쓴다",
              raw,
              "인용 · 목록 · 콜아웃 밖으로 옮긴다",
            ),
          );
        }
        break;
      }
      default:
        break;
    }
  }
}
