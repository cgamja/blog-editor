# workspace-settings-api Specification

## Purpose

워크스페이스 설정 API. 화면이 고칠 수 있는 것은 AI가 먼저 읽는 글쓰기 가이드뿐이고, 카테고리 · 연결 정보는 서버 설정에서 나와 읽기만 한다. 저장은 워크스페이스 경로(adr-007)다(이슈 #98).

## Requirements

### Requirement: 설정은 글쓰기 가이드를 읽고 쓰고, 카테고리 · 연결 정보는 읽기만 한다

`GET /api/settings`는 SHALL 워크스페이스 글쓰기 가이드(저장한 적 없으면 빈 문자열), 서버에 설정된 카테고리 목록, 연결 정보(`enabled` · `url`)를 돌려준다. `PUT /api/settings`는 `{ guide }`만 받아 가이드를 바꾸고, 카테고리 · 연결 정보는 바꾸지 않는다. 둘 다 세션이 있어야 한다. 요청 본문이 가이드 상한의 4배 바이트를 넘으면 읽기 전에 413이다.

#### Scenario: 저장한 적 없는 설정을 읽는다

- **WHEN** MCP가 꺼진 앱에서 설정을 처음 읽는다
- **THEN** 가이드는 빈 문자열, 카테고리는 앱에 설정된 목록 그대로, 연결 정보는 `enabled: false` · `url: null`이다

#### Scenario: 가이드를 저장하고 다시 읽는다

- **WHEN** 가이드를 저장한 뒤 설정을 다시 읽는다
- **THEN** 저장한 가이드가 오고 카테고리는 그대로다

#### Scenario: 틀린 저장은 가이드를 바꾸지 않는다

- **WHEN** JSON이 아닌 본문, 모르는 키(`categories`)가 든 본문, 상한보다 긴 가이드로 저장한다
- **THEN** 모두 400이고 가이드는 앞서 저장한 값 그대로다

#### Scenario: 세션 없는 저장은 401이고 가이드가 그대로다

- **WHEN** 가이드를 저장해 둔 뒤 세션 쿠키 없이 다른 가이드로 저장한다
- **THEN** 401이고 세션으로 읽은 가이드는 앞서 저장한 값 그대로다

### Requirement: 연결 주소는 OAuth 발급자에서 나온다

MCP와 OAuth가 켜져 있으면 연결 정보의 `url`은 SHALL `<발급자>/mcp`다. 연결용 토큰만 켜져 있으면 `enabled: true` · `url: null`이다(claude.ai가 닿는 주소가 아니다).

#### Scenario: OAuth가 켜진 앱의 연결 주소

- **WHEN** 발급자 `https://editor.example.com`으로 OAuth를 켠 앱의 설정을 읽는다
- **THEN** 연결 정보가 `enabled: true` · `url: "https://editor.example.com/mcp"`다

### Requirement: 파일 설정 저장소는 워크스페이스 경로에 남는다

파일 설정 저장소는 SHALL `<root>/workspaces/<id>/settings.json`에 쓰고, 새로 연 저장소 인스턴스가 같은 값을 읽는다.

#### Scenario: 새 인스턴스가 저장한 가이드를 읽는다

- **WHEN** 파일 저장소에 가이드를 쓰고 같은 루트로 새 저장소를 연다
- **THEN** 같은 가이드를 읽고 파일이 워크스페이스 경로에 있다

### Requirement: 설정 저장 요청 본문은 크기 상한이 있다

`PUT /api/settings`는 SHALL 요청 본문이 가이드 상한의 4배 바이트(UTF-8 한 글자 최대 4바이트)를 넘으면 읽기 전에 413과 크기 문장을 돌려주고 가이드를 바꾸지 않는다.

#### Scenario: 본문 상한을 넘긴 저장은 413이다

- **WHEN** 세션을 가진 채 본문 상한을 넘긴 본문으로 저장한다
- **THEN** 413 · 크기 문장이고 계약의 413 스키마를 따르며 가이드는 앞서 저장한 값 그대로다

### Requirement: 파일 설정 저장소는 틀린 파일을 읽지 않는다

파일 설정 저장소는 SHALL `settings.json`에 모르는 키가 있거나 값의 타입이 틀리면 읽기를 실패시킨다(빠진 키는 기본값).

#### Scenario: 모르는 키 · 틀린 타입이면 읽기가 실패한다

- **WHEN** `settings.json`에 모르는 키가 있거나 가이드가 문자열이 아닐 때 읽는다
- **THEN** 읽기가 실패한다
