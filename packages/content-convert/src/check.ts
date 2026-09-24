import type Token from "markdown-it/lib/token.mjs";
import {
  ALT_MAX_LENGTH,
  CALLOUT_TONES,
  CODE_LANGUAGE_PATTERN,
  HEADING_LEVELS,
  hrefSchema,
  imagePathSchema,
} from "@blog-editor/content-schema";
import { ALLOWED_IN, CALLOUT_CONTAINER_NAME, DEFAULT_CALLOUT_TONE } from "./constants";
import {
  calloutContainerNameMessage,
  calloutEmptyMessage,
  calloutNotClosedMessage,
  calloutToneMessage,
  codeLanguageMessage,
  containerNotAllowedMessage,
  emptyLinkTextMessage,
  footnoteInlineMessage,
  hardBreakMessage,
  headingLevelMessage,
  htmlNotAllowedMessage,
  imageAltLengthMessage,
  imageInContainerMessage,
  imageInHeadingMessage,
  imageMixedWithTextMessage,
  imagePathMessage,
  imageTitleMessage,
  linkSchemeMessage,
  linkTitleMessage,
  listItemMustStartWithParagraphMessage,
  listItemRepeatedBlockMessage,
  orderedListStartMessage,
  blockMessage,
  tableNotAllowedMessage,
  taskListMessage,
  type FoundMessage,
} from "./message";
import type { SpanOpenMeta } from "./span";
import { imageAltText } from "./tokens";
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
  if (rest === "") return { ok: true, tone: DEFAULT_CALLOUT_TONE };
  const match = /^tone=(\S+)$/.exec(rest);
  if (!match) return { ok: false, received: rest };
  const tone = match[1]!;
  if (!(CALLOUT_TONES as readonly string[]).includes(tone)) {
    return { ok: false, received: tone };
  }
  return { ok: true, tone };
}

/** ALLOWED_IN[parentKind]에 semantic이 들어 있는지 — check.ts의 유일한 진짜 로직이고, message.ts는
 * 같은 집합에서 "문단만" 같은 문장만 파생시킨다(로직과 문장이 서로 다른 파일에서 같은 값을 본다). */
function isAllowedInContainer(parentKind: ContainerKind, semantic: SemanticType): boolean {
  return ALLOWED_IN[parentKind].has(semantic);
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
}

/**
 * 토큰을 한 번 훑어 (1) 최상위 · 안쪽 블록 레지스트리, (2) 정의 밖 · 자리 밖 오류 메시지를 같이
 * 만든다(adr-013 ①). 여기서 오류가 하나라도 나오면 prosemirror-markdown은 절대 부르지 않는다 —
 * 스키마에 안 맞는 토큰을 오류 없이 버리기 때문이다(스파이크 #2).
 *
 * `titledReferenceHrefs`는 references.ts가 참조 정의에서 이미 title을 거부한 href들이다 — 참조로
 * resolve된 링크도 title 속성을 그대로 갖고 있어(markdown-it), 여기서 또 거부하면 같은 오류가
 * 두 군데(정의 줄 · 사용 줄)에서 중복 보고된다. 원인은 정의 줄이니 거기서만 한 번 알린다.
 */
export function analyzeTokens(
  tokens: readonly Token[],
  sourceLines: readonly string[],
  titledReferenceHrefs: ReadonlySet<string>,
): AnalyzeResult {
  const registry: BlockRecord[] = [];
  const messages: FoundMessage[] = [];
  const stack: ContainerKind[] = [];
  const listItemStates: ListItemState[] = [];
  let topLevel = 0;
  let currentBlock: BlockRecord | undefined;

  const container = (): "top" | ContainerKind =>
    stack.length === 0 ? "top" : stack[stack.length - 1]!;

  /** 레지스트리에 블록 한 칸을 더한다 — 배치가 맞는지는 검사하지 않는다(checkPlacement가 한다). */
  function openBlockRecord(
    semantic: SemanticType,
    mapStart0: number,
    mapEnd0: number,
  ): BlockRecord {
    const parentKind = container();
    if (parentKind === "top") topLevel += 1;
    const record: BlockRecord = { mapStart0, mapEnd0, semantic, container: parentKind, topLevel };
    registry.push(record);
    return record;
  }

  /** openBlockRecord가 만든 칸이 그 컨테이너 안에 올 수 있는 의미인지 본다(닫힌 집합: ALLOWED_IN,
   * message.ts가 파생시킨다). 목록 항목 안이면 "문단 하나 다음에 안쪽 목록만" 모양도 같이 본다. */
  function checkPlacement(record: BlockRecord): void {
    const parentKind = record.container;
    if (parentKind !== "top" && !isAllowedInContainer(parentKind, record.semantic)) {
      messages.push(
        containerNotAllowedMessage(
          record.topLevel,
          record.mapStart0 + 1,
          parentKind,
          sourceLines[record.mapStart0] ?? "",
        ),
      );
      return;
    }
    if (
      parentKind === "listItem" &&
      (record.semantic === "paragraph" ||
        record.semantic === "bulletList" ||
        record.semantic === "orderedList")
    ) {
      checkListItemShape(
        record,
        record.semantic,
        listItemStates[listItemStates.length - 1],
        sourceLines,
        messages,
      );
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    switch (tok.type) {
      case "paragraph_open":
        currentBlock = checkParagraphOpen(tok, tokens[i + 1], openBlockRecord, checkPlacement);
        break;
      case "heading_open":
        currentBlock = checkHeadingOpen(
          tok,
          tokens[i + 1],
          openBlockRecord,
          checkPlacement,
          sourceLines,
          messages,
        );
        break;
      case "blockquote_open": {
        const record = openBlockRecord("blockquote", ...mapOf(tok));
        checkPlacement(record);
        stack.push("blockquote");
        break;
      }
      case "blockquote_close":
        stack.pop();
        break;
      case "bullet_list_open": {
        const record = openBlockRecord("bulletList", ...mapOf(tok));
        checkPlacement(record);
        break;
      }
      case "ordered_list_open":
        checkOrderedListOpen(tok, openBlockRecord, checkPlacement, sourceLines, messages);
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
        checkFenceOrCodeBlock(tok, openBlockRecord, checkPlacement, messages);
        break;
      case "hr": {
        const record = openBlockRecord("horizontalRule", ...mapOf(tok));
        checkPlacement(record);
        break;
      }
      case "table_open":
        checkTableOpen(tok, openBlockRecord, checkPlacement, sourceLines, messages);
        break;
      case "html_block":
        checkHtmlBlock(tok, openBlockRecord, checkPlacement, sourceLines, messages);
        break;
      case "container_callout_open": {
        const isEmpty = tokens[i + 1]?.type === "container_callout_close";
        checkCalloutOpen(tok, isEmpty, openBlockRecord, checkPlacement, sourceLines, messages);
        stack.push("callout");
        break;
      }
      case "container_callout_close":
        stack.pop();
        break;
      case "inline":
        checkInline(tok, currentBlock, sourceLines, messages, titledReferenceHrefs);
        break;
      default:
        break;
    }
  }

  return { registry, messages };
}

type OpenBlockRecord = (semantic: SemanticType, mapStart0: number, mapEnd0: number) => BlockRecord;
type CheckPlacement = (record: BlockRecord) => void;

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
        listItemRepeatedBlockMessage(
          record.topLevel,
          record.mapStart0 + 1,
          sourceLines[record.mapStart0] ?? "",
        ),
      );
      return;
    }
    state.sawParagraph = true;
    return;
  }
  if (!state.sawParagraph) {
    messages.push(
      listItemMustStartWithParagraphMessage(
        record.topLevel,
        record.mapStart0 + 1,
        sourceLines[record.mapStart0] ?? "",
      ),
    );
    return;
  }
  state.sawListAfterParagraph = true;
}

function checkParagraphOpen(
  tok: Token,
  next: Token | undefined,
  openBlockRecord: OpenBlockRecord,
  checkPlacement: CheckPlacement,
): BlockRecord {
  const soleChild =
    next?.type === "inline" && next.children?.length === 1 ? next.children[0] : undefined;
  const semantic: SemanticType = soleChild?.type === "image" ? "image" : "paragraph";
  const [start, end] = mapOf(tok);
  const record = openBlockRecord(semantic, start, end);
  if (semantic === "image" && soleChild) record.imageAlt = imageAltText(soleChild);
  checkPlacement(record);
  return record;
}

function checkHeadingOpen(
  tok: Token,
  next: Token | undefined,
  openBlockRecord: OpenBlockRecord,
  checkPlacement: CheckPlacement,
  sourceLines: readonly string[],
  messages: FoundMessage[],
): BlockRecord {
  const [start, end] = mapOf(tok);
  const record = openBlockRecord("heading", start, end);
  checkPlacement(record);
  const level = Number(tok.tag.slice(1));
  if (!(HEADING_LEVELS as readonly number[]).includes(level)) {
    const text = next?.content ?? "";
    messages.push(headingLevelMessage(record.topLevel, start + 1, sourceLines[start] ?? "", text));
  }
  return record;
}

function checkOrderedListOpen(
  tok: Token,
  openBlockRecord: OpenBlockRecord,
  checkPlacement: CheckPlacement,
  sourceLines: readonly string[],
  messages: FoundMessage[],
): BlockRecord {
  const [start, end] = mapOf(tok);
  const record = openBlockRecord("orderedList", start, end);
  checkPlacement(record);
  const startAttr = tok.attrGet("start");
  if (startAttr !== null && Number(startAttr) !== 1) {
    messages.push(orderedListStartMessage(record.topLevel, start + 1, sourceLines[start] ?? ""));
  }
  return record;
}

function checkFenceOrCodeBlock(
  tok: Token,
  openBlockRecord: OpenBlockRecord,
  checkPlacement: CheckPlacement,
  messages: FoundMessage[],
): BlockRecord {
  const [start, end] = mapOf(tok);
  const record = openBlockRecord("codeBlock", start, end);
  checkPlacement(record);
  const lang = tok.type === "fence" ? tok.info.trim() : "";
  if (lang !== "" && !CODE_LANGUAGE_PATTERN.test(lang)) {
    messages.push(codeLanguageMessage(record.topLevel, start + 1, lang));
  }
  return record;
}

function checkTableOpen(
  tok: Token,
  openBlockRecord: OpenBlockRecord,
  checkPlacement: CheckPlacement,
  sourceLines: readonly string[],
  messages: FoundMessage[],
): BlockRecord {
  const [start, end] = mapOf(tok);
  const record = openBlockRecord("paragraph", start, end);
  checkPlacement(record);
  messages.push(tableNotAllowedMessage(record.topLevel, start + 1, sourceLines[start] ?? ""));
  return record;
}

function checkHtmlBlock(
  tok: Token,
  openBlockRecord: OpenBlockRecord,
  checkPlacement: CheckPlacement,
  sourceLines: readonly string[],
  messages: FoundMessage[],
): BlockRecord {
  const [start, end] = mapOf(tok);
  const record = openBlockRecord("paragraph", start, end);
  checkPlacement(record);
  messages.push(htmlNotAllowedMessage(record.topLevel, start + 1, sourceLines[start] ?? ""));
  return record;
}

function checkCalloutOpen(
  tok: Token,
  isEmpty: boolean,
  openBlockRecord: OpenBlockRecord,
  checkPlacement: CheckPlacement,
  sourceLines: readonly string[],
  messages: FoundMessage[],
): BlockRecord {
  const [start, end] = mapOf(tok);
  const raw = sourceLines[start] ?? "";
  const record = openBlockRecord("callout", start, end);
  checkPlacement(record);

  const containerName = tok.info.trim().split(/\s+/)[0] ?? "";
  if (containerName !== CALLOUT_CONTAINER_NAME) {
    messages.push(calloutContainerNameMessage(record.topLevel, start + 1, containerName));
    return record;
  }

  const closed = isClosingLine(sourceLines[end]);
  if (!closed) {
    messages.push(calloutNotClosedMessage(start + 1, raw));
  }
  if (isEmpty && closed) {
    messages.push(calloutEmptyMessage(record.topLevel, start + 1, raw));
  }

  const tone = parseCalloutTone(tok.info);
  if (!tone.ok) {
    messages.push(calloutToneMessage(record.topLevel, start + 1, tone.received));
  }
  return record;
}

function checkInline(
  tok: Token,
  block: BlockRecord | undefined,
  sourceLines: readonly string[],
  messages: FoundMessage[],
  titledReferenceHrefs: ReadonlySet<string>,
): void {
  if (!block) return;
  const children = tok.children ?? [];
  let currentLine = block.mapStart0 + 1;
  let activeLinkTextLength: number | null = null;

  children.forEach((child, index) => {
    checkInlineChild(child, index, block);
    // 토큰 안에 든 줄바꿈(여러 줄 HTML · title 등)도 다음 토큰의 줄 번호에 센다
    currentLine += embeddedLineBreaks(child);
  });

  function checkInlineChild(child: Token, index: number, block: BlockRecord): void {
    const lineText = sourceLines[currentLine - 1] ?? "";

    switch (child.type) {
      case "softbreak":
        currentLine += 1;
        return;
      case "hardbreak":
        messages.push(hardBreakMessage(block.topLevel, currentLine, lineText));
        currentLine += 1;
        return;
      case "span_open":
        // 괄호 span의 값 검사는 span.ts가 토큰을 만들 때 한 번 했다 — 여기서는 메시지로만 바꾼다
        for (const issue of (child.meta as SpanOpenMeta).issues) {
          messages.push(
            blockMessage(block.topLevel, currentLine, issue.rule, issue.received, issue.fix),
          );
        }
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
        checkLinkOpen(child, block, currentLine, messages, titledReferenceHrefs);
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
        checkImage(
          child,
          block,
          currentLine,
          lineText,
          children.length,
          messages,
          titledReferenceHrefs,
        );
        return;
      default:
        if (activeLinkTextLength !== null) activeLinkTextLength += child.content.length;
    }
  }
}

function embeddedLineBreaks(child: Token): number {
  const raw = child.content + (child.attrGet("title") ?? "");
  return raw.split("\n").length - 1;
}

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
  titledReferenceHrefs: ReadonlySet<string>,
): void {
  const href = child.attrGet("href") ?? "";
  const title = child.attrGet("title");
  if (title !== null && !titledReferenceHrefs.has(href)) {
    messages.push(linkTitleMessage(block.topLevel, line, title));
  }
  if (!hrefSchema.safeParse(href).success) {
    messages.push(linkSchemeMessage(block.topLevel, line, href));
  }
}

function checkImage(
  child: Token,
  block: BlockRecord,
  line: number,
  raw: string,
  siblingCount: number,
  messages: FoundMessage[],
  titledReferenceHrefs: ReadonlySet<string>,
): void {
  const src = child.attrGet("src") ?? "";
  const alt = imageAltText(child);
  const title = child.attrGet("title");
  if (title !== null && !titledReferenceHrefs.has(src)) {
    messages.push(imageTitleMessage(block.topLevel, line, title));
  }
  if (!imagePathSchema.safeParse(src).success) {
    messages.push(imagePathMessage(block.topLevel, line, src));
  }
  if (alt.length > ALT_MAX_LENGTH) {
    messages.push(imageAltLengthMessage(block.topLevel, line, alt));
  }

  if (block.semantic === "heading") {
    messages.push(imageInHeadingMessage(block.topLevel, line, raw));
  } else if (siblingCount !== 1) {
    messages.push(imageMixedWithTextMessage(block.topLevel, line, raw));
  } else if (block.container !== "top") {
    messages.push(imageInContainerMessage(block.topLevel, line, raw));
  }
}
