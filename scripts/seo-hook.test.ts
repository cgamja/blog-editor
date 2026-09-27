import { decideSeoHook, type HookInput } from "./seo-hook.lib";

/**
 * SEO 훅 판정(이슈 #149) — create_draft · update_draft 직후 PostToolUse 훅이 저장 응답의 seo를 읽어
 * must면 AI에게 되먹이고(block), should · info는 알리기만(notify), 볼 것이 없으면 지나간다(pass).
 *
 * 훅 입출력 근거: https://code.claude.com/docs/en/hooks#posttooluse-input (tool_name · tool_input · tool_response),
 * https://code.claude.com/docs/en/hooks#posttooluse-decision-control (decision "block" + reason이 Claude에게 간다),
 * https://code.claude.com/docs/en/hooks#json-output (systemMessage — "Warning message shown to the user").
 * MCP tool_response 모양은 문서가 정하지 않아("depends on the tool") 세 모양을 모두 받는다.
 *
 * 응답 픽스처는 apps/editor/api/src/mcp/tools.ts의 실제 응답 모양이다 — jsonResult(JSON.stringify(v, null, 2))로
 * 감싼 { slug, revision, editorUrl, seo, seoScore }, finding은 content-schema seo.ts의 finding()
 * ({ level, rule, target, ...SEO_MESSAGES[rule] })과 같은 키 · 문구. 루트는 content-schema에 의존하지 않아
 * (매니페스트 변경 필요) 문구를 옮겨 적었다.
 */

const CREATE = "mcp__blog-editor__create_draft";
const UPDATE = "mcp__blog-editor__update_draft";

const IMAGE_ALT_MUST = {
  level: "must",
  rule: "image-alt",
  target: { kind: "block", block: 2 },
  message: "이미지 설명(alt)이 비어 있어요.",
  fix: "사진에 무엇이 보이는지 한 문장으로 적어요. 검색 · 화면 읽기 프로그램이 이 글을 읽어요.",
};

const TITLE_LENGTH_SHOULD = {
  level: "should",
  rule: "title-length",
  target: { kind: "meta", field: "title" },
  message: "제목이 권장 길이(10~35자)를 벗어나요.",
  fix: "검색어를 앞쪽에 두고 권장 길이에 맞춰요. 너무 길면 검색 결과에서 잘려요.",
};

const DUPLICATE_TITLE_MUST = {
  level: "must",
  rule: "duplicate-title",
  target: { kind: "meta", field: "title" },
  message: "다른 글과 제목이 같아요.",
  fix: "이 글만의 내용이 드러나게 제목을 바꿔요.",
};

const NEW_DRAFT_ARGS = {
  slug: "ai-draft",
  title: "AI가 쓴 초안",
  description: "커넥터로 올린 초안",
  category: "studio",
  markdown: "첫 문단입니다.\n\n![](/images/cherry-walk.webp)",
};

function savedBody(seo: unknown[] | null, seoScore: number | null) {
  return {
    slug: "ai-draft",
    revision: "r-1",
    editorUrl: "http://localhost:5173/posts/ai-draft/edit",
    seo,
    seoScore,
  };
}

/** MCP CallToolResult — tools.ts jsonResult와 같은 감쌈 */
function mcpResult(body: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(body, null, 2) }] };
}

function hookInput(
  toolName: string,
  toolInput: Record<string, unknown>,
  toolResponse: unknown,
): HookInput {
  return { tool_name: toolName, tool_input: toolInput, tool_response: toolResponse } as HookInput;
}

const mustBody = savedBody([IMAGE_ALT_MUST], 75);

describe("seo-hook — 저장 직후 SEO 되먹임", () => {
  it("WHEN create_draft 응답에 must(image-alt)가 있고 아직 되먹인 적 없으면 THEN block으로 must 문구와 고칠 방법을 AI에게 주고 횟수가 1이 된다", () => {
    const decided = decideSeoHook(hookInput(CREATE, NEW_DRAFT_ARGS, mcpResult(mustBody)), {
      attempts: 0,
    });

    expect(decided.action).toBe("block");
    expect(decided.message).toContain(IMAGE_ALT_MUST.message);
    expect(decided.message).toContain(IMAGE_ALT_MUST.fix);
    expect(decided.message).toContain("update_draft");
    expect(decided.nextAttempts).toBe(1);
  });

  it("WHEN 응답에 should만 있으면 THEN 알리기만 하고 되먹인 횟수를 0으로 되돌린다", () => {
    const body = savedBody([TITLE_LENGTH_SHOULD], 90);

    const decided = decideSeoHook(hookInput(CREATE, NEW_DRAFT_ARGS, mcpResult(body)), {
      attempts: 2,
    });

    expect(decided.action).toBe("notify");
    expect(decided.message).toContain(TITLE_LENGTH_SHOULD.message);
    expect(decided.nextAttempts).toBe(0);
  });

  it("WHEN 점검이 됐고 지적이 하나도 없으면(seo []) THEN 지나가고 되먹인 횟수를 0으로 되돌린다", () => {
    const decided = decideSeoHook(
      hookInput(CREATE, NEW_DRAFT_ARGS, mcpResult(savedBody([], 100))),
      {
        attempts: 2,
      },
    );

    expect(decided.action).toBe("pass");
    expect(decided.nextAttempts).toBe(0);
  });

  it("WHEN must가 있지만 그 글에 이미 3번 되먹였으면 THEN 더 되먹이지 않고 알리기만 한다", () => {
    const decided = decideSeoHook(hookInput(CREATE, NEW_DRAFT_ARGS, mcpResult(mustBody)), {
      attempts: 3,
    });

    expect(decided.action).toBe("notify");
    expect(decided.message).toContain(IMAGE_ALT_MUST.message);
    expect(decided.nextAttempts).toBe(3);
  });

  it("WHEN update_draft에서 AI가 title을 직접 줬고 must가 그 title 칸뿐이면 THEN 되먹이지 않고 알리기만 한다", () => {
    const args = { slug: "ai-draft", revision: "r-1", title: "봄 벚꽃 산책 코스" };
    const body = savedBody([DUPLICATE_TITLE_MUST], 75);

    const decided = decideSeoHook(hookInput(UPDATE, args, mcpResult(body)), { attempts: 1 });

    expect(decided.action).toBe("notify");
    expect(decided.message).toContain(DUPLICATE_TITLE_MUST.message);
    // 되먹이지 않았으니 횟수는 그대로다(늘지도 되돌아가지도 않는다)
    expect(decided.nextAttempts).toBe(1);
  });

  it.each([
    ["seo가 null(저장 뒤 점검 실패)", CREATE, mcpResult(savedBody(null, null))],
    [
      "도구 오류 응답",
      CREATE,
      { isError: true, content: [{ type: "text", text: "이미 있는 주소예요." }] },
    ],
    ["다른 도구", "mcp__blog-editor__get_draft", mcpResult(mustBody)],
  ])("WHEN %s THEN 지나간다", (_name, toolName, response) => {
    const decided = decideSeoHook(hookInput(toolName, NEW_DRAFT_ARGS, response), { attempts: 0 });

    expect(decided.action).toBe("pass");
    expect(decided.nextAttempts).toBe(0);
  });

  it.each([
    ["CallToolResult 객체", mcpResult(mustBody)],
    ["content 배열만", mcpResult(mustBody).content],
    ["이미 파싱된 본문", mustBody],
  ])("WHEN tool_response가 %s 모양이어도 THEN must를 같게 판정해 block한다", (_name, response) => {
    const decided = decideSeoHook(hookInput(CREATE, NEW_DRAFT_ARGS, response), { attempts: 0 });

    expect(decided.action).toBe("block");
    expect(decided.message).toContain(IMAGE_ALT_MUST.message);
    expect(decided.nextAttempts).toBe(1);
  });
});
