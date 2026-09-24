# text-toolbar (이슈 #85)

## Why

사용자 요청(2026-09-24): "글꼴 바꾸는 게 없다", "폰트별로 두께 · 크기를 자유롭게", "색 프리셋 + `#RRGGBB`". ADR-020(#77)이 저장 형식(`textStyle` · `strike` · `underline`)을 열었지만 편집 화면에서 쓸 수단이 없다. 디자인 68:2의 인라인 툴바(굵게 · 기울임 · 링크 · 코드)를 넓혀 글자 단위 꾸미기를 한 곳에서 하게 한다.

## What Changes

- editor-core
  - `setTextStyle(patch)`: 고른 글자의 `textStyle` 속성을 합친다(글자 조각마다 제 속성은 둔다). `null`은 그 속성을 지우고, 속성이 모두 비면 마크를 뗀다
  - `textStyleSummary(state)`: 도구줄이 보일 값 — 속성마다 값 · 없음 · 여러 값, 마크마다 켜짐 여부
  - 마지막 색 기억 플러그인 + `applyLastColor`(⌘⇧H)
  - 키맵: ⌘U 밑줄 · ⌘⇧S 취소선 · ⌘⇧H 마지막 색
- editor-react
  - `TextToolbar`: 글자를 고르면 선택 위(자리가 없으면 아래)에 뜨는 어두운 알약. 굵게 · 기울임 · 밑줄 · 취소선 · 코드 · 링크 · 글꼴 · 두께 · 크기 · 글자색 · 배경색
  - 색 고르기: 프리셋 + `#` 입력, 대비 4.5:1 미만이면 경고(막지 않음)
  - 순수 함수: 대비 계산 · hex 입력 정리 · 도구줄 자리
  - 스타일 `text-toolbar.css`(package export 한 줄 — 보호 파일)

## Impact

- editor-core: `commands/text-style.ts` · `plugins/text-style-keymap.ts` · `index.ts`
- editor-react: `TextToolbar.tsx` 등 새 파일, `BlogEditor.tsx` · `extensions.ts` · `use-link-shortcut.ts` · `index.ts` · `package.json`(exports)
- 새 의존성 없음
- 하지 않는 것: 블록 단위 글꼴(꾸미기 패널에 있음), 정렬(#86)
