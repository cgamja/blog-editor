# block-align (이슈 #86)

## Why

사용자 요청(2026-09-24): 왼쪽 · 가운데 · 오른쪽 정렬. ADR-020(#77)이 블록 `align`(문단 · 제목 · 그림 · 앱 스크린샷)을 스키마 · 공개 HTML(`data-align` + post.css)에 열었고, 에디터 DOM도 `data-align`을 낸다. 바꿀 커맨드 · 단축키 · UI가 없다.

## What Changes

- editor-core `commands/align.ts`: `setBlockAlign(align)` · `alignOf(node)` · `defaultAlignOf(node)`
- editor-core `plugins/align-keymap.ts`: ⌘⇧L · ⌘⇧E · ⌘⇧R(`alignKeymap`) + `AlignKeys` 확장(등록만)
- editor-react: `blogEditorExtensions()`에 `AlignKeys`, 꾸미기 패널에 정렬 필드(3버튼), 폭 도구줄에 정렬 3버튼

## Impact

- 새 의존성 · 스키마 변경 없음(ADR-020이 연 속성만 쓴다)
- 하지 않는 것: 목록 · 인용 · 콜아웃 정렬(ADR-020이 막음), 양쪽 정렬
