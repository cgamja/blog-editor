# supabase-backend (이슈 #203)

## Why

ADR-044로 1단계 배포를 무료로 정했다 — 에디터 API는 Supabase Edge Function, 데이터는 Supabase Postgres · Storage. 서버리스 함수는 파일이 남지 않으므로 저장소를 Supabase로 옮겨야 하고, 로그인이 공개되므로 짧은 비밀번호를 버티는 누적 잠금이 필요하다(원래 #33). 무료 플랜에 받을 수 있는 백업이 없어 백업 · 복구도 같이 한다.

## 스파이크 결과 (2026-09-28, 코드는 버림)

- rolldown으로 api를 한 파일(1.6MB)로 묶으면 Deno 2.9에서 로그인(scrypt) · 공개 API · MCP가 그대로 돈다. 2만 자 `create_draft`는 CPU 60~90ms(한도 2초).
- 실행 중 파일 읽기 3곳(post.css · 형식 가이드 · 스티커)은 Deno 번들에서 깨진다 → 번들에 글자로 넣고, 스티커는 로컬 미리보기 전용.
- 실측(시험 함수 배포 후 삭제): 무료 Supabase는 **GET + `text/html` 응답만** `text/plain`으로 바꾼다. png · css · json · POST html · CSP/nosniff · `Set-Cookie`는 그대로다. 그래서 이슈의 "미리보기 HTML → JSON"은 **하지 않는다**(`POST /api/preview`라 안 바뀐다). 걸리는 곳은 `GET /oauth/authorize` 하나 → #204의 에디터 주소 중계가 그 경로만 Content-Type을 되돌린다.

## What Changes

- Supabase 저장소 5종(글 · 설정 · AI 되돌리기 · 사진 · OAuth) + 로그인 잠금 저장소. 기존 계약 스위트를 시험용 Supabase 프로젝트에서 통과한다.
- 로그인 잠금이 누적(15분 → 2배 → 상한 24시간)으로 바뀌고 규격이 async가 된다. 로컬 메모리 구현도 같은 규칙이다.
- 배포 진입점(Edge Function) — 해시 · 비밀만 받는 설정, 번들된 CSS · 가이드, `preview_post`는 지원 안 함.
- 백업(매일, 암호화 — 레포가 공개라 평문 덤프를 아티팩트에 올리지 않는다) · 복구 검증(분기).

## 결정 (가정 — 틀리면 고친다)

- **RLS는 켜고 정책 0개**: 이슈는 "공개 읽기는 발행 글만"이라 했지만 공개 조회는 API가 비밀 키로 걸러 내므로 anon에 읽기 정책을 열 이유가 없다 — 더 좁게 막는다.
- **계정 · 연결용 토큰은 함수 시크릿의 해시 1행**(표 없음) — 1단계 계정 1개(adr-007 구조는 `AccountStore` 규격이 유지).
- **사진은 비공개 버킷 + API 경유** — `GET /images/*`가 보안 헤더를 붙인다(실측으로 헤더가 살아남음 확인).
- **잠긴 횟수는 성공해야만 0** — 시간이 지나도 줄지 않는다(주인은 SQL 한 줄로 푼다).

## Impact

- 새 의존성: `@supabase/supabase-js`(ADR-044 승인) · `rolldown`(이번 ADR-046, 이미 vite 8 안에 같은 버전).
- 로컬 개발은 그대로 Memory · File · Node. Docker Supabase 없음.
- 하지 않는 것: 운영 프로젝트에 표 만들기 · 함수 배포(머지 뒤 사람 승인으로, 명령은 문서), 에디터 화면 배포 · 중계(#204), 사이트 이전(simsimeestudio-intro#15), 계정 표 · 가입(2단계).
