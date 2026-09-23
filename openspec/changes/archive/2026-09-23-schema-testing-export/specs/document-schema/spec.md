## ADDED Requirements

### Requirement: 원본 크기는 스키마가 내보내는 판정으로 읽는다

`@blog-editor/content-schema`는 SHALL `naturalSizeOf(attrs)`를 export한다 — `naturalWidth` · `naturalHeight`가 둘 다 있으면 `{ width, height }`, 아니면 `null`. 변환 · 직렬화 · 렌더는 원본 크기를 이 함수로만 읽는다.

#### Scenario: 짝이 있을 때만 크기를 돌려준다

- **WHEN** `{ naturalWidth: 1200, naturalHeight: 800 }` · `{}` · `{ naturalWidth: 1200 }`을 각각 넣는다
- **THEN** 차례로 `{ width: 1200, height: 800 }` · `null` · `null`
