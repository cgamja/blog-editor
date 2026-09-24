# decoration-v2-schema (이슈 #73)

## Why

꾸미기 1차를 써 본 사용자가 글자 단위 글꼴 · 두께 · 크기 · 색, 정렬, 취소선 · 밑줄, 더 작은 스티커를 요청했다. 방향은 "일반적으로 많이 쓰는 방식, AI 자동화에 초점"이다. adr-008의 닫힌 집합을 넓히는 결정은 ADR-020에 있다. 이 change는 UI 없이 그 바탕을 만든다: 스키마 · 공개 HTML · 본문 CSS · AI용 markdown 문법 · 에디터 스키마 등록 · MCP 형식 가이드.

## What Changes

- content-schema
  - 마크 `textStyle`(font · weight · size · color · highlight, 이름 붙은 값 + `#rrggbb`) · `strike` · `underline`
  - 블록 `align`(left · center · right): 문단 · 제목 · 이미지 · 앱 스크린샷
  - 스티커 size 최소 5 → 2
  - 픽스처 `allBlocks` · `decorationMax`에 새 값, fast-check 생성기
- content-render
  - `span.post-ts[data-*]` · `s` · `u` · 래퍼 `data-align`
  - hex만 `--ts-color` / `--ts-highlight` CSS 변수. 렌더러가 다시 검사한다
  - post.css 규칙
- content-convert
  - 괄호 span `[글자]{key=value …}` · `~~취소~~` · 지시어 `align=` 읽기 · 쓰기
  - 형식 가이드 `guide/format.md`
- editor-core: TipTap 마크 3개 · `align` attrs 등록, DOM 어휘는 렌더와 같다. UI는 없다

## Impact

- schemaVersion은 그대로 1이다. 추가와 완화뿐이라 기존 문서는 모두 유효하다(ADR-020).
- 공개 HTML의 어휘가 늘어난다. 사이트 sanitizer 허용 목록은 #8에서 추적한다.
- 렌더 스냅샷이 바뀐다: `allBlocks` · `decorationMax` 픽스처가 새 값을 쓴다.
- 하지 않는 것: 도구줄 · 정렬 버튼 · 단축키(3단계 P5 · P6), 대비 경고 UI
