import { buildWritePrompt, chatAppUrl } from "./prompt";

describe("web-ai-connect — AI로 쓰기는 커넥터 프롬프트를 만들어 채팅 앱을 새 탭으로 연다", () => {
  it("WHEN 주제 「신생아 수면 패턴」 · 카테고리 parenting으로 프롬프트를 만들면 THEN 그 주제 · 카테고리와 글쓰기 가이드를 먼저 읽으라는 말이 있다", () => {
    const prompt = buildWritePrompt("신생아 수면 패턴", "parenting");

    expect(prompt).toContain("「신생아 수면 패턴」");
    expect(prompt).toContain("parenting");
    expect(prompt).toContain("초안");
    expect(prompt).toContain("글쓰기 가이드");
  });

  it("WHEN Claude와 ChatGPT로 각각 채팅 주소를 만들면 THEN claude.ai/new와 chatgpt.com/에 q로 프롬프트가 실린다", () => {
    const prompt = "초안을 써 줘 & 올려 줘";

    const claude = new URL(chatAppUrl("claude", prompt));
    const chatgpt = new URL(chatAppUrl("chatgpt", prompt));

    expect(`${claude.origin}${claude.pathname}`).toBe("https://claude.ai/new");
    expect(claude.searchParams.get("q")).toBe(prompt);
    expect(`${chatgpt.origin}${chatgpt.pathname}`).toBe("https://chatgpt.com/");
    expect(chatgpt.searchParams.get("q")).toBe(prompt);
  });
});
