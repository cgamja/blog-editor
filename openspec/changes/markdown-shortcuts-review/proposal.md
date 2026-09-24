# markdown-shortcuts-review (PR #75 리뷰)

## Why

PR #75 리뷰 2축에서 나온 지적. 인라인 규칙이 선택이 있을 때 · 조합이 끝난 뒤 글자를 잘못 지우고, 단어 안 `*`(`2*3*`)에도 기울임이 걸린다. ⌘D가 거절되면 브라우저 북마크가 뜬다. 링크를 정확히 고르면 팝오버가 기존 주소를 못 찾는다. 여러 줄 코드 블록을 문단 · 제목으로 바꾸면 한 줄로 합쳐진다.

## What Changes

- 인라인 규칙: 선택이 있으면 처리하지 않음, 닫는 표시 중 이미 문서에 있는 글자 수를 계산, 여는 `*` 앞 라틴 문자 · 숫자면 처리하지 않음
- `Mod-d`: 거절돼도 키를 삼킨다(move-block의 `swallowing` 재사용)
- 코드 블록 → 문단은 줄마다 문단, 여러 줄 → 제목은 `false`
- editor-core `linkHrefAt` · `hasLinkTarget`, editor-react ⌘K는 `event.code === "KeyK"`도 본다(한글 입력 상태)
- 구조: `markdown-shortcuts.ts`를 `markdown-input-rules.ts` · `markdown-shortcut-keymap.ts`로 나누고 확장은 조립만, `useLinkShortcut` 훅 분리, 팝오버 · 블록 메뉴 그림자 · 층을 CSS 변수 한 곳으로

## Impact

- 새 의존성 없음
