# Spec Delta — supabase-store

## Purpose

배포(Supabase Edge Function)에서 글 · 설정 · AI 되돌리기 · 사진 · OAuth 상태를 Supabase Postgres · Storage에 둔다. 저장소 규격은 Memory · File과 같고, 같은 계약 스위트를 시험용 Supabase 프로젝트에서 통과한다(ADR-044).

## ADDED Requirements

### Requirement: Supabase 저장소는 기존 저장소 계약을 그대로 통과한다 (보호 대상 — 고쳐서 통과시키지 않는다)

Supabase 글 · AI 되돌리기 저장소는 SHALL post-store · ai-undo 계약 스위트를 시험용 Supabase 프로젝트에서 수정 없이 통과한다. 낡은 revision 쓰기는 `ConflictError`이고 저장된 글은 그대로이며, 같은 revision으로 동시에 쓰면 하나만 성공한다(조건부 쓰기 — 확인과 쓰기가 DB 안에서 한 번에 일어난다).

#### Scenario: 계약 스위트가 Supabase에서 초록이다

- **WHEN** `SUPABASE_TEST_URL` · `SUPABASE_TEST_SECRET_KEY`가 있는 환경에서 계약 스위트를 Supabase 저장소로 돌린다
- **THEN** Memory · File과 같은 시나리오(409 · 동시 쓰기 하나만 성공 포함)가 모두 통과한다

#### Scenario: 시험 키가 없으면 Supabase 층만 건너뛴다

- **WHEN** 시험 키 없이 `pnpm test`를 돌린다
- **THEN** Supabase 계약 층은 "시험 키 없음"으로 건너뛰고 나머지 층은 그대로 돈다. CI는 시험 키를 시크릿으로 받아 이 층을 돌린다

### Requirement: 워크스페이스가 다르면 서로의 데이터를 보지 않는다

Supabase 저장소는 SHALL 모든 행을 워크스페이스 id로 나눠(adr-007 `workspaces/<id>/…`) 다른 워크스페이스의 글 · 설정 · 되돌리기 기록을 읽거나 바꾸지 않는다.

#### Scenario: 같은 slug라도 워크스페이스가 다르면 따로다

- **WHEN** 워크스페이스 `a`와 `b`에 같은 slug로 다른 글을 쓴다
- **THEN** 각 저장소는 자기 글만 `get` · `list`하고, 한쪽 `delete`가 다른 쪽을 지우지 않는다

### Requirement: 설정 · 사진 · OAuth 상태도 Supabase에 남는다

Supabase 설정 저장소 · 이미지 저장소 · OAuth 저장소는 SHALL 새 인스턴스(함수가 새로 켜짐)로 열어도 같은 값을 준다. 이미지 이름 모양 검사(`isImageName`)는 그대로이고, OAuth 코드 · refresh는 꺼내는 즉시 지워져 두 번 쓸 수 없다.

#### Scenario: 새 인스턴스로 열어도 값이 같다

- **WHEN** 가이드 · 이미지 · OAuth 클라이언트를 쓰고 새 저장소 인스턴스로 읽는다
- **THEN** 같은 가이드 · 같은 바이트 · 같은 클라이언트가 나온다

#### Scenario: 인가 코드는 한 번만 꺼낸다

- **WHEN** 같은 코드 해시로 `takeCode`를 동시에 두 번 부른다
- **THEN** 하나만 코드를 받고 다른 하나는 `null`이다

### Requirement: DB · 사진은 서버 비밀 키로만 닿는다 (보호 대상)

Supabase 표는 SHALL RLS가 켜져 있고 공개(anon) · 로그인(authenticated) 역할에 정책이 하나도 없으며, 사진 버킷은 비공개다. 공개 조회는 API가 발행 글만 걸러 내주고(public-posts-api), DB를 직접 부르는 길은 없다 — 초안은 앱 필터와 DB 거부 두 겹으로 막힌다.

#### Scenario: 공개 키로 초안을 읽을 수 없다

- **WHEN** 초안 한 편이 있는 시험 프로젝트에 publishable(anon) 키로 글 표를 조회한다
- **THEN** 행이 0개이고, 사진 버킷 객체도 공개 URL로 받을 수 없다

실패 의미론: 응답 유실 후 재시도 · 동시 입력은 계약 스위트의 409 · 동시 쓰기 시나리오가 다룬다. 수명: OAuth 코드 · 토큰 만료는 기존 mcp-oauth 시나리오를 따른다.
