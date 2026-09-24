import { connectorStateOf } from "./connector";

describe("web-ai-connect — AI 연결 화면은 연결 주소 · 할 수 있는 일 · 글쓰기 가이드를 보여 준다", () => {
  it("WHEN 연결 정보가 주소 있음 · 켜졌지만 주소 없음 · 꺼짐이면 THEN 차례로 ready · no-public-url · off다", () => {
    expect([
      connectorStateOf({ enabled: true, url: "https://editor.example.com/mcp" }),
      connectorStateOf({ enabled: true, url: null }),
      connectorStateOf({ enabled: false, url: null }),
    ]).toEqual(["ready", "no-public-url", "off"]);
  });
});
