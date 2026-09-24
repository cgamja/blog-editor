# edit-screen (이슈 #97)

## Why

M3 편집 화면이 자리 표시뿐이다. editor-react의 편집 화면 틀(#74)은 있지만 글을 불러오고 · 저장하고 · 충돌을 풀고 · 발행하는 흐름이 web에 없다. 초안 주소를 바꾸는 API와, 공개 렌더러 그대로의 미리보기 길도 없다 — web은 content-render를 직접 import할 수 없다(adr-009 엣지 web → editor-react · content-schema).

## What Changes

- web `features/editor`: `/posts/new` · `/posts/:slug/edit` 편집 화면(내비 없는 전체 화면, 가드 안)
  - 불러오기(ETag = revision) · 제목(종이 위) · 「글 정보」 탭(주소 · 카테고리 · 설명 · 날짜 · 꾸미기 열기 · AI와 다듬기 자리)
  - 새 글 주소는 제목에서 영문(로마자) 제안, 발행 전까지 고칠 수 있고 발행하면 잠긴다
  - 저장: 자동(입력 멈추고 2초) + ⌘S · 「초안 저장」, 머리줄 문구(저장 중… / 초안 저장됨, 시각 / 저장하지 못했어요 · 다시 시도), 브라우저 localDraft, 401은 띠 + 다시 로그인 뒤 같은 글로
  - 409 대화상자(디자인 67:2 그대로) · 새 글 주소가 이미 있으면 주소 칸 문장
  - 발행: 확인 대화상자 → `PUT` `draft: false` → "빌드 중 — 1~2분 뒤 공개"
  - 미리보기: 서버가 공개 렌더러로 그린 HTML을 샌드박스 iframe에
- api: `POST /api/posts/{slug}/rename`(초안만, revision 확인) · `POST /api/preview`(`{ doc }` → 공개 렌더러 HTML). 계약 표 → `api/openapi.json` 다시 쓰기
- post-store: `delete(slug, revision)`(주소 바꾸기가 옛 파일을 지운다)
- editor-react `EditorScreen`: 종이 위 제목 자리 · 머리줄 아래 알림 띠 자리 · 바깥에서 고르는 옆 패널 탭(「꾸미기 열기」)
- query-client: mutation `meta.expiresSessionOnUnauthorized: false`면 401이어도 세션을 바꾸지 않는다(편집 화면은 띠로 알린다)

## Impact

- web 의존성: `@blog-editor/editor-react`(workspace, 허용 엣지) — 보호 파일이라 PR diff로 승인
- 보안 불변식 유지: 공개 API에 초안 없음(미리보기는 세션이 필요한 `/api` 아래) · 409 · 발행은 사람만(MCP 도구 변경 없음)
- 하지 않는 것: 카테고리 목록 API(#98 설정) — 기존 글의 카테고리를 제안하고 자유 입력, 서버 zod가 최종 검증 · AI와 다듬기(#98) · 발행 취소 · 대표 이미지
