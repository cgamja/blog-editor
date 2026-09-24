# Design — import-connect

## 1. 설정 저장

- `SettingsStore { get(): Promise<WorkspaceSettings>; put(settings): Promise<void> }` — 워크스페이스 하나에 파일 하나. 1단계는 사용자 한 명이라 revision 없이 마지막 쓰기가 이긴다(글과 달리 두 탭 동시 편집의 손실이 작다). 파일 저장소는 글 저장소처럼 임시 파일 → rename
- `createApp`의 `settings`는 선택이고 없으면 메모리 저장소다 — 라우트는 항상 있어 계약의 라우트 집합이 옵션에 따라 바뀌지 않는다
- 응답의 `categories`는 `AppOptions.categories` 그대로(원천 하나). `connector`는 `{ enabled: mcp가 켜졌나, url: OAuth 발급자가 있으면 <issuer>/mcp, 없으면 null }` — 연결용 토큰만 있는 로컬 `/mcp`는 claude.ai가 닿는 주소가 아니라서 null
- 가이드 길이 상한 20,000자 — 형식 가이드와 합쳐 MCP 응답 한 번에 실릴 양

## 2. 가져오기 미리보기

- `convertMarkdown`의 실패는 전부 막는 오류다. 결정 A의 "빠지지만 가져오는" 손실 목록은 변환기에 없어 만들지 않는다 — 메시지 목록(세 칸 문장, 줄 번호 포함)을 그대로 보여 주고 버튼을 끈다
- 미리보기 HTML은 공개 렌더러(`renderHtml`, 서버의 `imageBaseUrl`)가 만든다. web은 `srcdoc` + `sandbox`(스크립트 없음) iframe에 `/public/post.css`와 함께 넣는다 — 공개 페이지와 같은 렌더러 · CSS, 그리고 렌더 결과가 에디터 화면 스타일과 섞이지 않는다
- 제안: 제목 = 첫 제목 블록의 글자, 설명 = 첫 문단 글자(160자에서 자름). 없으면 빈 문자열 — 화면이 입력을 받는다
- markdown 상한은 MCP와 같은 200,000자(상수 한 곳)

## 3. web

- 기능 폴더 셋, 각자 `index.ts`로만 내보낸다(web 층 린트). 화면 CSS는 기능 폴더의 CSS 파일 — 병렬 이슈와 `app.css` 충돌을 피한다
- 순수 함수(초안 파일 만들기 · 주소 제안 · 만들기 가능 여부 · 프롬프트 · 채팅 앱 주소 · 연결 상태)만 node 테스트, 대화상자 · 화면은 실브라우저
- 채팅 앱 주소: `https://claude.ai/new?q=<프롬프트>` · `https://chatgpt.com/?q=<프롬프트>` — 실제 `<a target="_blank" rel="noopener noreferrer">`
- `/connect`는 라우터 한 줄. 목록의 「가져오기」 · 「AI로 쓰기」 버튼과 셸 nav 연결은 #96이 머지된 뒤
