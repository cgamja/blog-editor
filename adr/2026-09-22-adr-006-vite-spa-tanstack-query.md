# ADR-006. 화면은 React + Vite SPA(React Router · TanStack Query)로 만든다 — WEB-SPEC 기본값(Next.js)에서 벗어난다

- 날짜: 2026-09-22
- 상태: 승인됨
- 원천: 설계 문서 D2 · 02 Tech Stack · 3-5 에디터 내부

## 문제 (맥락)

WEB-SPEC의 기본값은 Next.js다. 그런데 이 화면은 로그인 뒤에서만 쓰는 도구이고(로그인 · 목록 · 편집 · AI 연결), 편집 경로 `/posts/:slug/edit`는 빌드 때 모르는 동적 경로다. TipTap은 SSR과 상성이 나쁘다(hydration 우회 설정이 필요).

## 결정

- **React 19 + Vite SPA + React Router.** WEB-SPEC 표의 「로그인 뒤에서만 쓰는 내부 도구 · 어드민 → React + Vite SPA」 행에 해당한다. SSR이 없으니 TipTap hydration 우회가 필요 없고, TipTap 공식 React 가이드도 Vite 기준이다.
- 서버 상태는 **TanStack Query**: 글 목록 · 글 하나(+ETag) · 저장 mutation · 이미지 업로드 mutation. 409 처리와 목록 무효화가 주 용도.
- 문서 상태는 TipTap `Editor`가 가진 ProseMirror `EditorState` 하나. React는 `useEditorState`(선택자 구독)로 읽기만 하고, 바꿀 때는 커맨드로 Transaction을 보낸다. **Zustand는 쓰지 않는다** — 문서 상태는 상태관리 라이브러리의 몫이 아니고, 그 밖의 클라이언트 상태(패널 열림 등)는 컴포넌트 지역 상태로 충분하다.
- CSS는 TailwindCSS 4 + `cn`. 토큰은 사이트 `globals.css`의 값을 옮긴다(수동 복사로 시작 — plan 09).
- 개발은 Vite 프록시로 로컬 API와 같은 출처. 운영도 CloudFront 아래 같은 도메인이라 `SameSite=Strict` 쿠키로 충분하다.

## 버린 대안

- **Next.js 정적 export**: 동적 경로를 빌드 때 열거해야 한다. 글마다 재빌드가 필요해진다.
- **Next.js SSR(Lambda)**: SEO가 필요 없는 화면에 서버 렌더 비용과 TipTap SSR 우회를 얹는다. 「판단이 안 서면 Next」 규칙은 SEO · 초기 로딩이 중요할 때의 것이다.
- **Zustand로 문서 상태 복제**: 진실이 둘이 된다(EditorState와 스토어). ProseMirror의 단방향 흐름을 깬다.

## 감수한 트레이드오프

- SPA → Next 이전은 비싸다. 이 화면이 대외 페이지가 될 일은 없다고 본다. 2단계 랜딩 · 가입 페이지가 필요하면 그것은 사이트 레포(Next)의 일이다.
- 라우팅 · 코드 분할 · 인증 리다이렉트를 직접 짠다. 화면이 넷이라 작다.
- 사이트 레포와 프레임워크가 달라 컴포넌트를 공유하지 못한다. 공유할 것은 토큰 값뿐이고 그것은 CSS다.

## 재검토 조건

- 에디터 화면 자체가 검색에 노출되어야 할 때(없을 것으로 본다).
- 2단계에서 워크스페이스 · 가입 화면이 늘어 라우팅이 복잡해질 때 — 그래도 SPA 안에서 풀린다.
