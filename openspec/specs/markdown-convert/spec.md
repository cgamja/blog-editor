# markdown-convert Specification

## Purpose

markdown(MCP 입력 문법)을 문서 JSON으로 바꾸는 `convertMarkdown`의 함수 계약. 받는 문법과 거부 목록은 markdown-format · markdown-callout · markdown-directive, 메시지는 markdown-validation-message가 정하고, 이 스펙은 결과 모양(성공 doc 또는 실패 메시지 전부)과 순수성만 정한다(adr-013).

## Requirements

### Requirement: `convertMarkdown`은 성공 doc 또는 실패 메시지 전부를 돌려주는 순수 함수다

`@blog-editor/content-convert`는 SHALL `convertMarkdown(markdown: string)`을 export한다. 결과는 `{ ok: true, doc, messages: [] }` 또는 `{ ok: false, messages }`(`messages`는 비어 있지 않은 문자열 배열) 둘 중 하나다. 성공한 `doc`은 `docSchema`를 통과하고 `normalize(doc)`와 같다(정규형 — 마크 순서 · 인접 텍스트 병합 · 키 순서, document-normalize). 메시지의 형식 · 순서는 markdown-validation-message를 따르고, 받는 문법과 거부 목록은 markdown-format · markdown-callout · markdown-directive를 따른다. 같은 입력은 같은 결과이고 서버 상태 · 파일 · 네트워크를 건드리지 않는다. 입력이 문자열이 아니거나 파서 내부 오류가 나도 예외를 던지지 않고 `문서 (1줄): …` 메시지로 돌려준다.

#### Scenario: 성공 결과는 정규형 doc이다

- **WHEN** `***굵고 기울임*** 뒤` · 빈 줄 · `` `코드`와 [링크](/blog/) `` 두 문단을 변환한다
- **THEN** `ok: true` · `messages: []`이고 `doc`이 `docSchema`를 통과하며 `normalize(doc)`와 깊은 비교로 같다

#### Scenario: 실패 결과에는 doc이 없다

- **WHEN** `# 제목` 한 줄을 변환한다
- **THEN** `ok: false`이고 `doc` 키가 없으며 `messages`가 정확히 `["블록 1 (1줄): 제목은 ##·###만 쓴다(받음: \"# 제목\") → \"## 제목\""]`이다

실패 의미론: 해당 없음 — 순수 변환(서버 상태 없음).
