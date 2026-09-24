# block-align-review (PR #88 리뷰 반영, 이슈 #86)

## Why

PR #88은 "기본 모양 정렬은 저장하지 않는다"를 에디터 커맨드에만 두었다. 마크다운 가져오기(`{align=center}` 그림)나 MCP 초안으로 들어온 기본값은 그대로 저장돼, 같은 모양의 문서가 두 가지 저장 형식을 갖는다. 또 여러 블록에 걸친 선택에서 패널은 첫 블록의 정렬만 눌림으로 보였다.

## What Changes

- content-schema `defaultAlignOf(type)`를 export하고, `normalize`가 블록 종류의 기본 모양과 같은 `align`을 지운다(정규형 ⑤). editor-core `setBlockAlign` · `alignOf`는 이 판정을 쓴다 — 규칙 한 곳
- 꾸미기 패널 정렬 값은 대상 블록이 모두 같은 모양일 때만, 아니면 null(아무것도 눌리지 않음)
- 정렬 이름("왼쪽" 등)은 decoration-messages `alignName` 한 곳

## Impact

- 저장 형식: 기본 모양 align은 이제 저장되지 않는다. 기존 픽스처 · 계약 스냅샷은 기본이 아닌 값만 써서 바뀌지 않는다
- 하지 않는 것: 정렬할 수 없는 블록에서 단축키를 눌렀을 때의 안내(aria-live) — 후속
