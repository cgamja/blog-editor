import { promptCopyText } from "./photo-prompt-model";

const PROMPT = "A sleeping baby in a dim nursery, soft window light, 35mm film photo";

describe("photo-prompt — 「프롬프트 복사」는 비율을 붙인다", () => {
  it("WHEN 비율 4:3 · 이미 --ar가 있는 프롬프트에 4:3 · 비율 없음으로 복사 글을 만든다 THEN --ar 4:3이 붙고 · 그대로고 · 그대로다", () => {
    expect(promptCopyText(PROMPT, "4:3")).toBe(`${PROMPT} --ar 4:3`);
    expect(promptCopyText(`${PROMPT} --ar 16:9`, "4:3")).toBe(`${PROMPT} --ar 16:9`);
    expect(promptCopyText(PROMPT, undefined)).toBe(PROMPT);
  });
});
