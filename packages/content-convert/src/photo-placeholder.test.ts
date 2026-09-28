import { docSchema } from "@blog-editor/content-schema";
import type { Doc } from "@blog-editor/content-schema";
import { convertMarkdown, editDocRange, serializeMarkdown } from "./index";

const BRIEF = "잠든 아기 옆 낮잠 방";
const IMAGE_SRC = "/images/cherry-walk.webp";

function doc(...content: Record<string, unknown>[]): Doc {
  return docSchema.parse({ type: "doc", content });
}

function paragraph(value: string): Record<string, unknown> {
  return { type: "paragraph", content: [{ type: "text", text: value }] };
}

function placeholder(brief: string, ratio?: string): Record<string, unknown> {
  return { type: "photoPlaceholder", attrs: ratio === undefined ? { brief } : { brief, ratio } };
}

describe("photo-placeholder — markdown :::photo는 사진 자리다", () => {
  it("WHEN :::photo ratio=4:3 두 줄 설명과 비율 없는 :::photo를 변환한다 THEN 사진 자리 두 개이고 설명은 한 줄로 이어진다", () => {
    const markdown = [
      ":::photo ratio=4:3",
      "잠든 아기 옆",
      "어두운 낮잠 방",
      ":::",
      "",
      ":::photo",
      "공원 벤치의 도시락",
      ":::",
    ].join("\n");

    const result = convertMarkdown(markdown);

    expect(result).toEqual({
      ok: true,
      doc: doc(
        placeholder("잠든 아기 옆 어두운 낮잠 방", "4:3"),
        placeholder("공원 벤치의 도시락"),
      ),
      messages: [],
    });
  });

  it("WHEN 비율 5:4 · 빈 설명 · 굵은 설명 · 두 문단 설명 · 인용 안 :::photo · 지시어 줄 앞 :::photo를 변환한다 THEN 모두 실패하고 메시지에 사진 자리가 있다", () => {
    const inputs = [
      ":::photo ratio=5:4\n설명\n:::",
      ":::photo\n:::",
      ":::photo\n**굵은** 설명\n:::",
      ":::photo\n첫 문단\n\n둘째 문단\n:::",
      "> :::photo\n> 설명\n> :::",
      "{motion=fade-up}\n:::photo\n설명\n:::",
    ];

    const results = inputs.map((markdown) => convertMarkdown(markdown));

    for (const result of results) {
      expect(result.ok).toBe(false);
      expect(result.messages.join("\n")).toContain("사진 자리");
    }
  });

  it("WHEN 문법 글자가 든 설명의 사진 자리와 비율 없는 사진 자리를 직렬화하고 다시 변환한다 THEN 같은 문서이고 losses가 없다", () => {
    const input = doc(placeholder("# 잠든 *아기* [방]", "16:9"), placeholder(BRIEF));

    const { markdown, losses } = serializeMarkdown(input);
    const back = convertMarkdown(markdown);

    expect(losses).toEqual([]);
    expect(back).toEqual({ ok: true, doc: input, messages: [] });
  });

  it("WHEN brief가 있는 그림을 직렬화한다 THEN 그림 문법 그대로이고 losses에 imageBrief가 있다", () => {
    const input = doc({ type: "image", attrs: { src: IMAGE_SRC, alt: "봄 산책", brief: BRIEF } });

    const { markdown, losses } = serializeMarkdown(input);

    expect(markdown).toBe(`![봄 산책](${IMAGE_SRC})\n`);
    expect(losses).toEqual([{ block: 1, kind: "imageBrief", count: 1 }]);
  });
});

describe("photo-prompt — 사진 자리의 이미지 프롬프트는 markdown으로 왕복한다", () => {
  it("WHEN 설명과 prompt: 문단이 있는 :::photo ratio=4:3을 변환하고 다시 직렬화한다 THEN 사진 자리의 prompt가 그 글이고 같은 markdown이 나온다", () => {
    const prompt = "A sleeping baby in a dim nursery, soft window light, 35mm film photo";
    const markdown = [":::photo ratio=4:3", BRIEF, "", `prompt: ${prompt}`, ":::"].join("\n");

    const result = convertMarkdown(markdown);
    const back = result.ok ? serializeMarkdown(result.doc) : null;

    expect(result).toEqual({
      ok: true,
      doc: doc({ type: "photoPlaceholder", attrs: { brief: BRIEF, ratio: "4:3", prompt } }),
      messages: [],
    });
    expect(back).toEqual({ markdown: `${markdown}\n`, losses: [] });
  });
});

describe("photo-placeholder — 부분 고치기는 사진 자리를 설명으로 집는다", () => {
  it("WHEN 설명 전체로 새 사진 자리로 바꾸고 · 빈 글로 지우고 · 설명 일부만 바꾼다 THEN 새 사진 자리 · 문단만 · 블록 일부 실패다", () => {
    const input = doc(paragraph("봄 산책"), placeholder(BRIEF));

    const replaced = editDocRange(input, {
      command: "replace",
      selection: "잠든...낮잠 방",
      markdown: ":::photo ratio=1:1\n깬 아기의 웃는 얼굴\n:::",
    });
    const removed = editDocRange(input, { command: "replace", selection: BRIEF, markdown: "" });
    const partial = editDocRange(input, {
      command: "replace",
      selection: "잠든 아기",
      markdown: "깬 아기",
    });

    expect(replaced).toEqual({
      ok: true,
      doc: doc(paragraph("봄 산책"), placeholder("깬 아기의 웃는 얼굴", "1:1")),
      messages: [],
    });
    expect(removed).toEqual({ ok: true, doc: doc(paragraph("봄 산책")), messages: [] });
    expect(partial.ok).toBe(false);
    expect(partial.messages.join("\n")).toContain("블록 일부");
  });
});

describe("photo-prompt — prompt: 문단은 설명과 빈 줄로 나뉜 둘째 문단이다", () => {
  const PROMPT = "A sleeping baby in a dim nursery, soft window light";

  it("WHEN 설명 바로 다음 줄에 prompt:를 쓰고 · 설명 없이 prompt:로 시작한다 THEN 둘 다 실패이고 설명과 prompt: 사이에 빈 줄을 두라고 알린다", () => {
    const joined = convertMarkdown([":::photo", BRIEF, `prompt: ${PROMPT}`, ":::"].join("\n"));
    const promptOnly = convertMarkdown([":::photo", `prompt: ${PROMPT}`, ":::"].join("\n"));

    for (const result of [joined, promptOnly]) {
      expect(result.ok).toBe(false);
      expect(result.messages.join("\n")).toContain("설명과 prompt: 사이에 빈 줄");
    }
  });

  it("WHEN 빈 prompt: · 1001자 prompt: · prompt:로 시작하지 않는 둘째 문단을 쓴다 THEN 각각 빈 프롬프트 · 1000자 · prompt: 문단 형식 실패다", () => {
    const withSecond = (second: string) =>
      convertMarkdown([":::photo", BRIEF, "", second, ":::"].join("\n"));

    const results = [
      withSecond("prompt:"),
      withSecond(`prompt: ${"a".repeat(1001)}`),
      withSecond(PROMPT),
    ];

    expect(results.map((result) => result.ok)).toEqual([false, false, false]);
    expect(results[0]!.messages.join("\n")).toContain("이미지 프롬프트가 있어야");
    expect(results[1]!.messages.join("\n")).toContain("1000자");
    expect(results[2]!.messages.join("\n")).toContain("prompt:로 시작하는");
  });

  it("WHEN 에디터에서 prompt:로 시작하게 고친 설명을 직렬화하고 다시 변환한다 THEN 같은 설명의 사진 자리다", () => {
    const input = doc(placeholder(`prompt: ${BRIEF}`));

    const back = convertMarkdown(serializeMarkdown(input).markdown);

    expect(back).toEqual({ ok: true, doc: input, messages: [] });
  });
});
