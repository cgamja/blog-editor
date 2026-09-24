# ADR-013. md → doc 변환은 prosemirror-markdown + markdown-it-container로 하고, 토큰 단계에서 먼저 검사한다

- 날짜: 2026-09-23
- 상태: 승인됨 · 트레이드오프의 속성 테스트 약속 → 이슈 #38로 이행
- 원천: plan 3-5 라이브러리 표("Markdown 변환 — prosemirror-markdown") · plan 11 M0 스파이크 표(`:::callout` 파싱) · 이슈 #2 스파이크 결과 댓글 · 스펙 markdown-format · markdown-callout · markdown-directive · markdown-validation-message

## 문제 (맥락)

MCP 도구(`check_draft` · `create_draft` · `update_draft`)와 에디터 가져오기(M3)는 markdown을 받아 문서 JSON으로 바꾼다. 변환은 서버(Lambda)에서도 돌아야 하므로 TipTap에 기대지 않는다(`@tiptap/markdown` 불가, plan 3-5). 표준 문법 외에 `:::callout` 컨테이너가 필요하고, 실패하면 AI가 혼자 고칠 수 있도록 원문 줄 번호가 달린 메시지를 전부 모아 돌려줘야 한다.

## 결정

- `packages/content-convert`의 dependency로 `prosemirror-markdown` · `prosemirror-model` · `markdown-it`(14 — prosemirror-markdown의 peer 범위에 맞춤) · `markdown-it-container`, devDependency로 `@types/markdown-it-container`를 둔다.
- 변환은 두 단계다. ① markdown-it 토큰을 직접 걸어 정의 밖 문법 · 콜아웃 경계 · 지시어를 검사하고 메시지를 모은다(줄 번호는 토큰 `map`). ② 오류가 없을 때만 prosemirror-markdown의 `MarkdownParser`로 doc를 만들고 `docSchema`로 마지막 검증을 한다. **②는 스키마에 안 맞는 토큰을 오류 없이 버리므로(스파이크 #2), 거부는 전부 ①에서 한다.**
- ProseMirror 스키마는 content-convert 안에 둔다(content-schema는 ProseMirror를 모른다 — adr-009). 그 스키마의 출력은 항상 zod `docSchema`를 지나므로 둘이 어긋나면 테스트가 잡는다.
- LIBRARY 게이트(cgamja `docs/spec/LIBRARY.md`) 검진 — 2026-09-23 기준:

| 항목        | 값                                                                                                                                    | 판정                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 유지보수    | prosemirror-markdown 1.13.8 · prosemirror-model 1.25.12(2026-09-21), markdown-it-container 4.0.0(2023-12)                             | 통과 — container는 zero-dep 완성 플러그인이라 릴리스 공백을 감수 |
| 사용 규모   | ProseMirror 공식 패키지, markdown-it 컨테이너 플러그인의 표준                                                                         | 통과                                                             |
| 번들 크기   | 서버 · 에디터 가져오기에서만 로드, 공개 사이트에는 안 나간다                                                                          | 통과                                                             |
| 전이 의존성 | prosemirror-markdown → markdown-it · prosemirror-model(→ orderedmap) · @types/markdown-it                                             | 통과                                                             |
| 보안        | `pnpm audit` high/critical 없음(설치 시 확인). 출력은 `docSchema`의 닫힌 집합만 통과                                                  | 통과                                                             |
| 타입        | prosemirror-* TS 내장, markdown-it은 `@types/markdown-it`(prosemirror-markdown이 끌고 옴), container는 `@types/markdown-it-container` | 통과                                                             |
| 모듈 형식   | ESM, Vitest node에서 동작(스파이크 #2)                                                                                                | 통과                                                             |
| 라이선스    | 전부 MIT                                                                                                                              | 통과                                                             |

## 버린 대안

- **`@tiptap/markdown`**: 에디터 인스턴스가 필요해 서버에서 못 돈다.
- **markdown-it 토큰 → JSON 직접 조립(prosemirror-markdown 없이)**: 의존성이 하나 줄지만 doc → md 직렬화(`get_post`, 후속)와 에디터 붙여넣기에서 같은 규칙을 다시 짜야 한다. prosemirror-markdown은 파서와 직렬화기를 한 벌의 토큰 · 노드 대응으로 준다.
- **`@mdit/plugin-container`**: markdown-it 15를 peer로 요구해 prosemirror-markdown(14)과 markdown-it이 두 벌이 된다.
- **컨테이너 블록 규칙 직접 작성(~40줄)**: 동작은 했지만 들여쓰기 · 목록 안 마커 같은 엣지 케이스를 떠안는다(스파이크 #2).

## 감수한 트레이드오프

- 토큰 단계 검사와 prosemirror-markdown 토큰 규칙이 같은 문법을 두 번 안다. 검사에서 빠진 문법은 조용히 버려질 수 있다 — 스펙 시나리오 테스트가 거부 목록을 전부 덮고, 변환 결과를 `docSchema`로 다시 검증하는 것으로 줄인다.
- ProseMirror 스키마가 content-convert와 editor-core(TipTap `getSchema`)에 두 벌 생긴다. zod ↔ PM 스키마 일치 속성 테스트(plan 05)는 editor-core가 생길 때 둘 다 대상으로 한다.
- markdown-it을 15로 올리지 못한다(prosemirror-markdown이 14에 묶여 있다).

## 재검토 조건

- prosemirror-markdown이 markdown-it 15로 올라갈 때 — 같이 올린다.
- markdown-it-container가 markdown-it 14 · 15에서 깨질 때 — 직접 블록 규칙으로 바꾼다.
- 토큰 단계 검사가 놓친 문법이 조용히 사라진 사례가 한 번이라도 나올 때 — 직접 JSON 조립안을 다시 본다.
