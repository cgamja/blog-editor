# seo-check (이슈 #138)

## Why

글은 AI가 쓰는 게 기본이 되었다(2026-09-25 사용자 방향). 기술 SEO(canonical · OG · BlogPosting · sitemap)는 사이트가 이미 자동으로 한다. 빠진 것은 **글 내용 SEO**다 — 이미지 설명(alt) · 소제목 · 제목과 요약 길이 · 첫 문단 · 핵심 검색어 · 내부 링크. AI가 긴 대화에서 가이드를 잊어도 이것이 잡혀야 하고, 사람이 에디터에서 발행할 때도 같은 기준을 봐야 한다. 발행 글을 고쳐도 `updated`가 바뀌지 않아 사이트의 `dateModified`가 오래된 채로 남는 문제도 있다.

## What Changes

- **content-schema `checkSeo`**: AI를 부르지 않는 순수 함수다. 입력은 글 정보 · 문서 · 다른 글 요약이다. 출력은 등급(must · should · info) · 규칙 · 위치(메타 칸 또는 블록 번호) · 메시지 · 고칠 방법이다. 기준 숫자는 이름 붙인 상수로 둔다.
- **글 정보 `keyword`**: 핵심 검색어를 담는 선택 칸이다. 저장 전용이라 공개 조회 · 목록 요약으로 나가지 않는다. schemaVersion은 1 그대로다(선택 필드 추가, adr-020 선례).
- **MCP**
  - `check_draft` · `create_draft` · `update_draft` 응답에 `seo` 검사 결과가 늘 붙는다.
  - `create_draft` · `update_draft`는 `keyword`를 선택 인자로 받고, `check_draft`는 `title` · `description` · `keyword`가 오면 함께 검사한다.
  - 서버 `instructions`에 "쓰기 전에 get_writing_guide를 읽고 SEO 검사 결과를 고친다"를 넣는다.
  - 형식 가이드에 SEO 규칙을 짧게 넣는다.
- **API `PUT /api/posts/:slug`**: 발행 글(저장된 판과 새 판이 모두 `draft: false`)의 제목 · 설명 · 본문이 바뀌면 서버가 `updated`를 오늘(Asia/Seoul)로 올린다.
- **web**
  - 발행 확인 대화상자에 "검색 노출 점검" 목록을 둔다. must가 남아도 발행을 막지 않는다.
  - 「글 정보」에 핵심 검색어 칸을 둔다.
- ADR-030.

## Impact

- MCP 쓰기 도구 응답 모양이 넓어진다: `seo` 필드가 늘어난다(기존 필드는 그대로).
- 하지 않는 것:
  - 검사로 저장 · 발행을 막기
  - 외부 SEO 도구 · LLM 호출
  - 사이트 레포 변경
  - 목록 API에 description 추가 — 그래서 에디터의 중복 검사는 제목만 한다
