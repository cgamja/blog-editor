import fc from "fast-check";
import { convertMarkdown, serializeMarkdown } from "@blog-editor/content-convert";
import { docArbitrary } from "@blog-editor/content-schema/testing";
import { createEditorSchema, docFromNode, docToNode } from "./index";

const schema = createEditorSchema();

/** 변환까지 거치므로 schema.test의 docArbitrary 왕복(1000)보다 한 표본이 무겁다 */
const CONVERT_ROUNDTRIP_RUNS = 500;

// adr-013 약속(이슈 #38): content-convert의 pmSchema는 markdown 중간 스키마라 직접 비교할 수 없다.
// 대신 변환이 실제로 내놓는 doc이 에디터 스키마를 무손실로 지나는지를 본다 — MCP 초안이 에디터에서 바뀌지 않는다.
describe("editor-schema: markdown 변환 결과는 에디터를 오가도 바뀌지 않는다", () => {
  it("WHEN 문서 생성기 표본을 serialize → convert해 성공한 doc을 docToNode → docFromNode로 돌린다 THEN 모두 변환 결과와 같다", () => {
    fc.assert(
      fc.property(docArbitrary, (input) => {
        const converted = convertMarkdown(serializeMarkdown(input).markdown);
        // 스티커 · 빈 문단만 있던 문서는 직렬화에서 모두 빠져 변환이 실패한다 — 이 테스트의 대상이 아니다
        fc.pre(converted.ok);
        if (!converted.ok) return;
        expect(docFromNode(docToNode(schema, converted.doc))).toEqual(converted.doc);
      }),
      { numRuns: CONVERT_ROUNDTRIP_RUNS },
    );
  }, 30_000);
});
