# Tasks — content-render (이슈 #6)

기존 코드: `packages/content-render`는 없다(새 패키지). 입력 타입 · 픽스처 · 닫힌 집합 상수(`FONTS` · `MOTIONS` · `CALLOUT_TONES` · `STICKER_IDS`)는 `@blog-editor/content-schema`(`packages/content-schema/src/index.ts`)에서만 가져온다 — ESLint 경계(adr-009)가 다른 import를 막는다. 테스트는 Vitest node(DOM 없음). 테스트 task가 구현 task보다 먼저이며 `test(render):` 커밋으로 분리한다. 스냅샷 파일(`__snapshots__/*.snap`)도 테스트 패턴이라 `test(render):` 커밋에만 들어간다.

## 1. 패키지 뼈대

- [x] 1.1 `packages/content-render/{package.json, tsconfig.json, src/index.ts, src/render.ts}` — `package.json`은 content-schema와 같은 모양(`exports`에 `"."`와 `"./post.css"`, `dependencies`에 `@blog-editor/content-schema: workspace:*`, `typecheck` 스크립트) → 사람 승인(보호 파일) → 인자 없는 `pnpm install`로 lockfile 동기화. `render.ts`는 `renderHtml`이 `Error("not implemented")`를 던지는 스텁(테스트가 "모듈 없음"이 아니라 "기능 미구현"으로 빨강이 되게) → verify: `pnpm typecheck` 초록 · `git status`에 lockfile 변경만

## 2. 렌더러

- [x] 2.1 `src/render.test.ts` — html-render 시나리오 4개(픽스처 3개 스냅샷 + 입력 불변 · 마크 중첩 순서 · imageBaseUrl 끝 슬래시 · 이스케이프) + render-safety 시나리오 2개(금지 패턴 3종 · 속성 닫힌 목록) + render-decoration 시나리오 4개(래퍼 속성 · 래퍼 없음 · 스티커 두 개 · 9종 크기 상수). 픽스처는 `fixtures`를 import(복붙 금지) → verify: `pnpm vitest run packages/content-render` 빨강 · 실패 원문 보고
- [x] 2.2 `src/render.ts` + `src/stickers.ts`(9종 픽셀 크기 상수) + `src/escape.ts` — 블록 · 마크 · 꾸미기 래퍼 · 스티커 img · imageBaseUrl · 이스케이프. `index.ts`에 `renderHtml` · `RenderOptions` export → verify: 2.1 초록(스냅샷 첫 기록 포함) + `pnpm test` PASS_TO_PASS
- [x] 2.3 스냅샷 파일 `src/__snapshots__/render.test.ts.snap`을 눈으로 검토(픽스처 3개의 태그 · 속성이 spec 대응표와 같은지) → `test(render):` 커밋 → verify: `git show --stat`에 .snap만

## 3. 본문용 CSS

- [x] 3.1 `src/post-css.test.ts` — render-css 시나리오 3개(토큰 참조만 · enum 값마다 선택자 · 움직임 규칙이 두 조건 안에만). 파일은 `node:fs`로 읽는다(`/// <reference types="node" />`) → verify: 빨강(파일 없음) 원문 보고
- [x] 3.2 `src/post.css` — `.post-body` 기본 모양(사이트 `.prose` 값 복사) · 글씨체 3종 · 콜아웃 tone 3종 · 코드 · 이미지 프레임 · 앱 스크린샷 프레임 · `.post-block` 폭/기준 · `.post-sticker` 위치(48rem 이하 clamp) · 움직임 5종 keyframes(두 조건 안) → verify: 3.1 초록 + `pnpm exec prettier --check packages/content-render`

## 4. Converge · 브라우저 확인

- [x] 4.1 `.claude/state/evidence/content-render/preview.html`(gitignored)에 `decorationMax` 렌더 + `post.css` + 사이트 토큰 `:root` 복사본을 넣고 크롬에서: 스크롤 진입 움직임 · 줄이기 설정에서 즉시 보임 · 스티커가 블록 기준으로 붙음 · 1280/375 폭 → 스크린샷 경로를 PR 확인 방법에 → verify: screenshot 1280/375
- [x] 4.2 spec 4개의 `#### Scenario` 15개(자동 14 ↔ 테스트 14 · 수동 1 = 4.1 스크린샷) 대조, 빠진 것은 여기 append. 글꼴 서브셋(`pnpm fonts`)은 사이트 레포 작업(#8)으로 넘긴다 → verify: `pnpm verify` 초록 출력
