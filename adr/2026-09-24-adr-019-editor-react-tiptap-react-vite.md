# ADR-019. editor-react는 React 19 · `@tiptap/react`로 마운트하고, 개발용 플레이그라운드는 Vite로 띄운다

- 날짜: 2026-09-24
- 상태: 승인됨
- 원천: 이슈 #53 · editor-react-mount change(design.md) · adr-002(TipTap v3) · adr-006(React 19 + Vite SPA) · adr-009(경계) · adr-017(직접 정의한 확장 · 버전 고정)

## 문제 (맥락)

editor-core(스키마 · 커맨드 · 플러그인)는 DOM 없이 섰다. 그런데 M2 완료 조건인 한글 입력 체크리스트(#44)와 스파이크 #2(TipTap×React19 한글)는 **실브라우저에 에디터가 떠야** 확인할 수 있다. adr-006이 화면을 React 19 + Vite SPA로 정했지만, 그 결정을 실행할 패키지 · 버전은 아직 없다.

## 결정

- `apps/editor/editor-react`에 `@tiptap/react`의 `useEditor` · `EditorContent`로 마운트한다(https://tiptap.dev/docs/editor/getting-started/install/react).
- 버전은 모두 **정확히 고정**한다: react · react-dom 19.3.0, `@tiptap/react` 3.31.3(editor-core의 `@tiptap/core` · `@tiptap/pm`과 같은 버전 — adr-017), vite 8.3.0, `@vitejs/plugin-react` 6.1.1, `@types/react` · `@types/react-dom` 19.3.0. 모두 공개 뒤 하루 넘게 지났다(pnpm 최소 공개 기간 게이트 통과, 우회 없음).
- React 19.3.0은 WEB-SPEC 기준일(19.2.x) 뒤에 나온 minor다 — adr-006의 "React 19" 안이고, 공개 뒤 2주가 지났다.
- react · react-dom은 `dependencies`에 둔다. editor-react는 배포하지 않는 내부 패키지라 버전을 정하는 주체가 자신이다(adr-017의 TipTap과 같은 이유). web이 생기면 같은 버전으로 맞춘다.
- 플레이그라운드(`playground/`)는 개발용이다. `PORT` env 필수 + `strictPort`(병렬 worktree). vite · plugin-react · 타입은 devDependencies.
- DOM 테스트 환경(happy-dom · jsdom)은 들이지 않는다. 조립 함수(확장 목록 · 초기 content · 저장 문서)는 Vitest node에서, 마운트 · 조합 입력은 실브라우저에서 본다.

### LIBRARY 2단계 검진

| 항목        | 결과                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 사용 규모   | 주간 다운로드(npm, 2026-09-15~21): react 약 1억 3천만 · `@vitejs/plugin-react` 약 6,700만 · `@tiptap/react` 약 1,100만                                                                                                                                                                                                                                                                                  |
| 유지 상태   | react 19.3.0(2026-09-09) · vite 8.3.0(2026-09-10) · plugin-react 6.1.1(2026-08-28) · `@tiptap/react` 3.31.3(2026-09-04) — 모두 활발히 나온다                                                                                                                                                                                                                                                            |
| 라이선스    | 모두 MIT                                                                                                                                                                                                                                                                                                                                                                                                |
| 타입        | `@tiptap/react` · vite · plugin-react는 `.d.ts` 포함. react · react-dom은 `@types/react` · `@types/react-dom` 19.3.0                                                                                                                                                                                                                                                                                    |
| 모듈 형식   | 모두 ESM 제공(`@tiptap/react`는 ESM+CJS)                                                                                                                                                                                                                                                                                                                                                                |
| 번들 · 크기 | unpacked: react-dom 약 8.1MB(개발 · 프로덕션 빌드 모두 포함) · react 약 180KB · `@tiptap/react` 약 570KB · plugin-react 약 45KB. 실제 번들 크기는 web(M3) 빌드에서 잰다                                                                                                                                                                                                                                 |
| 전이 의존성 | lockfile에 새로 들어온 것: scheduler · use-sync-external-store · `@types/use-sync-external-store` · fast-equals · csstype · `@tiptap/extension-bubble-menu` · `@tiptap/extension-floating-menu`(`@tiptap/react`의 optionalDependencies) · `@floating-ui/{dom,core,utils}`. vite · rolldown은 vitest가 이미 들였고 한 벌을 공유한다. **prosemirror-model은 1.25.12 한 벌**(`pnpm why prosemirror-model`) |
| 대안        | 버린 대안 절                                                                                                                                                                                                                                                                                                                                                                                            |
| 보안        | `pnpm audit --prod` 알려진 취약점 없음(2026-09-24) · 정확 고정이라 패치는 사람이 올린다                                                                                                                                                                                                                                                                                                                 |

## 버린 대안

- **ProseMirror `EditorView`를 React 없이 직접 마운트**: TipTap 확장(StickerSafeSplit · MoveBlock 등 `addKeyboardShortcuts` · `addProseMirrorPlugins`)을 editor-core가 이미 TipTap 모양으로 짰다. 직접 마운트하면 확장 해석을 다시 짜야 하고, 이후 NodeView · 툴바는 어차피 React(adr-006)다.
- **플레이그라운드를 web(M3) 패키지로**: web은 라우팅 · TanStack Query · 인증까지 딸린 화면이다. 한글 체크만을 위해 M3를 앞당기면 범위가 커진다. 플레이그라운드는 editor-react 안에 두고, web이 생기면 web의 편집 화면이 이를 대신한다.
- **렌더 테스트용 happy-dom/jsdom**: contentEditable · 조합 입력은 jsdom에서 제대로 돌지 않는다(vitest.config 주석). 의존성만 늘고 확인하려는 것(IME)은 못 본다.

## 감수한 트레이드오프

- React 렌더 · 훅 동작은 자동 테스트가 없다. 플레이그라운드의 실브라우저 확인(headless 콘솔 오류 0 · DOM)과 #44 수동 체크리스트에 기댄다.
- `@tiptap/react`가 optional로 bubble · floating menu와 floating-ui를 끌고 온다. 지금은 쓰지 않는다.
- 정확 고정이라 React · TipTap 보안 패치를 사람이 올려야 한다. 올릴 때 한글 체크리스트를 다시 돈다.

## 재검토 조건

- web(M3)이 생겨 플레이그라운드가 편집 화면과 겹칠 때 — 플레이그라운드를 지우거나 스토리 역할만 남긴다.
- `@tiptap/react`가 editor-core와 다른 `@tiptap/pm` 버전을 요구할 때(모델 두 벌 위험 — adr-017).
- web이 다른 React 버전을 요구해 React 인스턴스가 두 벌이 될 때(invalid hook call) — 버전을 한 곳에서 맞추거나 editor-react를 peerDependencies로 바꾼다.
- React 렌더 동작 버그가 수동 확인을 빠져나가 두 번 이상 생길 때 — Playwright 컴포넌트 테스트(브라우저 층) 도입을 본다.
