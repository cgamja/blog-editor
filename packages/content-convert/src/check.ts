import type Token from "markdown-it/lib/token.mjs";
import {
  ALT_MAX_LENGTH,
  CALLOUT_TONES,
  CODE_LANGUAGE_PATTERN,
  HEADING_LEVELS,
  hrefSchema,
  imagePathSchema,
} from "@blog-editor/content-schema";
import { ALLOWED_IN, CONTAINER_LABEL } from "./constants";
import {
  blockMessage,
  docMessage,
  emptyLinkTextMessage,
  footnoteInlineMessage,
  htmlNotAllowedMessage,
  taskListMessage,
  type FoundMessage,
} from "./message";
import { CALLOUT_CONTAINER_NAME } from "./tokens";
import type { BlockRecord, ContainerKind, SemanticType } from "./types";

const FOOTNOTE_INLINE = /\[\^[^\]\s]+\]/;
const TASK_LIST_MARKER = /^\[[ xX]\]( |$)/;

/** `:::` 닫는 줄인가 — 인용(`>`) · 목록(들여쓰기) 안의 콜아웃도 있어 그 접두사를 먼저 벗긴다. */
function isClosingLine(line: string | undefined): boolean {
  if (line === undefined) return false;
  const stripped = line.replace(/^(?:[ \t]*>[ \t]?)*[ \t]*/, "");
  return /^:{3,}[ \t]*$/.test(stripped);
}

export function parseCalloutTone(
  info: string,
): { ok: true; tone: string } | { ok: false; received: string } {
  const rest = info
    .trim()
    .replace(/^callout\s*/, "")
    .trim();
  if (rest === "") return { ok: true, tone: "note" };
  const match = /^tone=(\S+)$/.exec(rest);
  if (!match) return { ok: false, received: rest };
  const tone = match[1]!;
  if (!(CALLOUT_TONES as readonly string[]).includes(tone)) return { ok: false, received: tone };
  return { ok: true, tone };
}

function mapOf(tok: Token): [number, number] {
  return tok.map ?? [0, 0];
}

/** 목록 항목 하나의 진행 상태 — "문단 하나, 그다음 안쪽 목록 0개 이상"만 허용한다(리뷰 #1). */
interface ListItemState {
  sawParagraph: boolean;
  sawListAfterParagraph: boolean;
}

export interface AnalyzeResult {
  registry: BlockRecord[];
  messages: FoundMessage[];
  /** link_open · image 토큰에서 실제로 쓰인 href/src — 안 쓰인 링크 참조 정의를 찾는 데 쓴다. */
  usedHrefs: Set<string>;
}

/**
 * 토큰을 한 번 훑어 (1) 최상위 · 안쪽 블록 레지스트리, (2) 정의 밖 · 자리 밖 오류 메시지, (3) 실제로
 * 쓰인 링크 href를 같이 만든다(adr-013 ①). 여기서 오류가 하나라도 나오면 prosemirror-markdown은
 * 절대 부르지 않는다 — 스키마에 안 맞는 토큰을 오류 없이 버리기 때문이다(스파이크 #2).
 */
export function analyzeTokens(
  tokens: readonly Token[],
  sourceLines: readonly string[],
): AnalyzeResult {
  const registry: BlockRecord[] = [];
  const messages: FoundMessage[] = [];
  const usedHrefs = new Set<string>();
  const stack: ContainerKind[] = [];
  const listItemStates: ListItemState[] = [];
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
    } else if (
      parentKind === "listItem" &&
      (semantic === "paragraph" || semantic === "bulletList" || semantic === "orderedList")
    ) {
      checkListItemShape(
        record,
        semantic,
        listItemStates[listItemStates.length - 1],
        sourceLines,
        messages,
      );
    }
    return record;
  }

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    switch (tok.type) {
      case "paragraph_open":
        currentBlock = checkParagraphOpen(tok, tokens[i + 1], openRecord);
        break;
      case "heading_open":
        currentBlock = checkHeadingOpen(tok, tokens[i + 1], openRecord, sourceLines, messages);
        break;
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
      case "ordered_list_open":
        checkOrderedListOpen(tok, openRecord, sourceLines, messages);
        break;
      case "list_item_open":
        stack.push("listItem");
        listItemStates.push({ sawParagraph: false, sawListAfterParagraph: false });
        break;
      case "list_item_close":
        stack.pop();
        listItemStates.pop();
        break;
      case "fence":
      case "code_block":
        checkFenceOrCodeBlock(tok, openRecord, messages);
        break;
      case "hr":
        openRecord("horizontalRule", mapOf(tok)[0], mapOf(tok)[1]);
        break;
      case "table_open":
        checkTableOpen(tok, openRecord, sourceLines, messages);
        break;
      case "html_block":
        checkHtmlBlock(tok, openRecord, sourceLines, messages);
        break;
      case "container_callout_open": {
        const isEmpty = tokens[i + 1]?.type === "container_callout_close";
        checkCalloutOpen(tok, isEmpty, openRecord, sourceLines, messages);
        stack.push("callout");
        break;
      }
      case "container_callout_close":
        stack.pop();
        break;
      case "inline":
        checkInline(tok, currentBlock, sourceLines, messages, usedHrefs);
        break;
      default:
        break;
    }
  }

  return { registry, messages, usedHrefs };
}

type OpenRecord = (semantic: SemanticType, mapStart0: number, mapEnd0: number) => BlockRecord;

function checkListItemShape(
  record: BlockRecord,
  semantic: "paragraph" | "bulletList" | "orderedList",
  state: ListItemState | undefined,
  sourceLines: readonly string[],
  messages: FoundMessage[],
): void {
  if (!state) return;
  if (semantic === "paragraph") {
    if (state.sawParagraph || state.sawListAfterParagraph) {
      messages.push(
        blockMessage(
          record.topLevel,
          record.mapStart0 + 1,
          "목록 항목은 문단 하나 다음에 안쪽 목록만 온다",
          sourceLines[record.mapStart0] ?? "",
          "문단 하나로 시작하고 그 아래에 안쪽 목록만 둔다",
        ),
      );
      return;
    }
    state.sawParagraph = true;
    return;
  }
  if (!state.sawParagraph) {
    messages.push(
      blockMessage(
        record.topLevel,
        record.mapStart0 + 1,
        "목록 항목은 문단 하나로 시작한다",
        sourceLines[record.mapStart0] ?? "",
        "문단 하나로 시작하고 그 아래에 안쪽 목록을 둔다",
      ),
    );
    return;
  }
  state.sawListAfterParagraph = true;
}

function checkParagraphOpen(
  tok: Token,
  next: Token | undefined,
  openRecord: OpenRecord,
): BlockRecord {
  const soleChild =
    next?.type === "inline" && next.children?.length === 1 ? next.children[0] : undefined;
  const semantic: SemanticType = soleChild?.type === "image" ? "image" : "paragraph";
  const [start, end] = mapOf(tok);
  const record = openRecord(semantic, start, end);
  if (semantic === "image" && soleChild) record.imageAlt = soleChild.content;
  return record;
}

function checkHeadingOpen(
  tok: Token,
  next: Token | undefined,
  openRecord: OpenRecord,
  sourceLines: readonly string[],
  messages: FoundMessage[],
): BlockRecord {
  const [start, end] = mapOf(tok);
  const record = openRecord("heading", start, end);
  const level = Number(tok.tag.slice(1));
  if (!(HEADING_LEVELS as readonly number[]).includes(level)) {
    const text = next?.content ?? "";
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
  return record;
}

function checkOrderedListOpen(
  tok: Token,
  openRecord: OpenRecord,
  sourceLines: readonly string[],
  messages: FoundMessage[],
): void {
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
}

function checkFenceOrCodeBlock(tok: Token, openRecord: OpenRecord, messages: FoundMessage[]): void {
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
}

function checkTableOpen(
  tok: Token,
  openRecord: OpenRecord,
  sourceLines: readonly string[],
  messages: FoundMessage[],
): void {
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
}

function checkHtmlBlock(
  tok: Token,
  openRecord: OpenRecord,
  sourceLines: readonly string[],
  messages: FoundMessage[],
): void {
  const [start, end] = mapOf(tok);
  const record = openRecord("paragraph", start, end);
  messages.push(htmlNotAllowedMessage(record.topLevel, start + 1, sourceLines[start] ?? ""));
}

function checkCalloutOpen(
  tok: Token,
  isEmpty: boolean,
  openRecord: OpenRecord,
  sourceLines: readonly string[],
  messages: FoundMessage[],
): void {
  const [start, end] = mapOf(tok);
  const raw = sourceLines[start] ?? "";
  const record = openRecord("callout", start, end);

  const containerName = tok.info.trim().split(/\s+/)[0] ?? "";
  if (containerName !== CALLOUT_CONTAINER_NAME) {
    messages.push(
      blockMessage(
        record.topLevel,
        start + 1,
        `컨테이너는 :::${CALLOUT_CONTAINER_NAME}만 쓴다`,
        containerName,
        `:::${CALLOUT_CONTAINER_NAME}`,
      ),
    );
    return;
  }

  const closed = isClosingLine(sourceLines[end]);
  if (!closed) {
    messages.push(docMessage(start + 1, "콜아웃이 닫히지 않았다", raw, '끝에 ":::" 줄 추가'));
  }
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
  if (!tone.ok) {
    messages.push(
      blockMessage(
        record.topLevel,
        start + 1,
        `콜아웃 tone은 ${CALLOUT_TONES.join(" · ")}만 쓴다`,
        tone.received,
        ":::callout tone=tip",
      ),
    );
  }
}

function checkInline(
  tok: Token,
  block: BlockRecord | undefined,
  sourceLines: readonly string[],
  messages: FoundMessage[],
  usedHrefs: Set<string>,
): void {
  if (!block) return;
  const children = tok.children ?? [];
  let currentLine = block.mapStart0 + 1;
  let activeLinkTextLength: number | null = null;

  children.forEach((child, index) => {
    const lineText = sourceLines[currentLine - 1] ?? "";

    switch (child.type) {
      case "softbreak":
        currentLine += 1;
        return;
      case "hardbreak":
        messages.push(
          blockMessage(
            block.topLevel,
            currentLine,
            "줄 끝 공백 둘이나 \\로 강제 줄바꿈은 쓸 수 없다",
            lineText,
            "문단을 그대로 잇거나(공백 하나) 새 문단으로 나눈다",
          ),
        );
        currentLine += 1;
        return;
      case "s_open":
        messages.push(
          blockMessage(
            block.topLevel,
            currentLine,
            "취소선(~~)은 정의 밖이다",
            lineText,
            "취소선을 지운다",
          ),
        );
        return;
      case "html_inline":
        messages.push(htmlNotAllowedMessage(block.topLevel, currentLine, child.content));
        return;
      case "text":
        checkInlineText(child, block, currentLine, index, messages);
        if (activeLinkTextLength !== null) activeLinkTextLength += child.content.length;
        return;
      case "link_open":
        activeLinkTextLength = 0;
        checkLinkOpen(child, block, currentLine, messages, usedHrefs);
        return;
      case "link_close":
        if (activeLinkTextLength === 0) {
          messages.push(emptyLinkTextMessage(block.topLevel, currentLine, lineText));
        }
        activeLinkTextLength = null;
        return;
      case "code_inline":
        if (activeLinkTextLength !== null) activeLinkTextLength += child.content.length;
        return;
      case "image":
        checkImage(child, block, currentLine, lineText, children.length, messages, usedHrefs);
        return;
      default:
        if (activeLinkTextLength !== null) activeLinkTextLength += child.content.length;
    }
  });
}

/** 첫 자식이면 할 일 목록 모양(`[ ]`/`[x]`/`[X]`)을, 어디든 각주 모양(`[^label]`)을 찾는다. */
function checkInlineText(
  child: Token,
  block: BlockRecord,
  line: number,
  index: number,
  messages: FoundMessage[],
): void {
  if (index === 0 && block.container === "listItem" && TASK_LIST_MARKER.test(child.content)) {
    messages.push(taskListMessage(block.topLevel, line, child.content));
  }
  const footnote = FOOTNOTE_INLINE.exec(child.content);
  if (footnote) {
    messages.push(footnoteInlineMessage(block.topLevel, line, footnote[0]));
  }
}

function checkLinkOpen(
  child: Token,
  block: BlockRecord,
  line: number,
  messages: FoundMessage[],
  usedHrefs: Set<string>,
): void {
  const href = child.attrGet("href") ?? "";
  usedHrefs.add(href);
  const title = child.attrGet("title");
  if (title !== null) {
    messages.push(
      blockMessage(block.topLevel, line, "링크의 title은 쓸 수 없다", title, "title을 지운다"),
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
}

function checkImage(
  child: Token,
  block: BlockRecord,
  line: number,
  raw: string,
  siblingCount: number,
  messages: FoundMessage[],
  usedHrefs: Set<string>,
): void {
  const src = child.attrGet("src") ?? "";
  usedHrefs.add(src);
  const alt = child.content;
  const title = child.attrGet("title");
  if (title !== null) {
    messages.push(
      blockMessage(block.topLevel, line, "이미지의 title은 쓸 수 없다", title, "title을 지운다"),
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

  if (block.semantic === "heading") {
    messages.push(
      blockMessage(
        block.topLevel,
        line,
        "이미지는 최상위 블록에서만 쓴다",
        raw,
        "이미지만 있는 문단으로 따로 쓴다(제목 밖으로 옮긴다)",
      ),
    );
  } else if (siblingCount !== 1) {
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
}
