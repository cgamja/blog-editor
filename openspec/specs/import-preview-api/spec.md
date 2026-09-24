# import-preview-api Specification

## Purpose

마크다운 가져오기의 변환을 서버가 맡는다. web은 변환 코어(content-convert)에 닿지 못해(adr-009) 미리보기 API로 변환 결과 · 공개 렌더러 HTML · 제목/설명 제안 또는 줄 번호 메시지를 받고, 초안 저장은 기존 글 저장 API로 한다(이슈 #98).

## Requirements

### Requirement: 가져오기 미리보기는 변환 결과만 돌려주고 저장하지 않는다

`POST /api/import/preview`는 SHALL `{ markdown }`을 변환 코어로 바꿔, 성공하면 `{ ok: true, doc, html, suggested: { title, description } }`를, 실패하면 `{ ok: false, messages }`를 200으로 돌려준다. `doc`은 정규형, `html`은 공개 렌더러 결과, 제안은 첫 제목 블록과 첫 문단의 글자다 — 제목은 80자, 설명은 160자까지(글 메타 상한과 같은 UTF-16 길이, 서로게이트 쌍을 가르지 않는다). 어느 경우에도 글 저장소를 바꾸지 않는다. 본문이 JSON이 아니거나 `markdown`이 문자열이 아니거나 상한보다 길면 400, 요청 본문이 상한의 4배 바이트를 넘으면 413, 세션이 없으면 401이다.

#### Scenario: 맞는 markdown이면 변환 결과와 제안이 온다

- **WHEN** 제목 블록과 문단이 있는 markdown으로 미리보기를 부른다
- **THEN** `ok: true`이고 doc이 문서 스키마를 통과하고, html에 그 문단이 있고, 제안 제목 · 설명이 첫 제목 · 첫 문단이며, 글 목록은 비어 있다

#### Scenario: 틀린 markdown이면 줄 번호 메시지가 온다

- **WHEN** 지원하지 않는 블록(표)이 든 markdown으로 미리보기를 부른다
- **THEN** `ok: false`이고 메시지에 그 줄 번호가 있으며, 글 목록은 비어 있다

#### Scenario: 틀린 요청은 400이다

- **WHEN** JSON이 아닌 본문, `markdown`이 없는 본문, 상한보다 긴 markdown으로 부른다
- **THEN** 모두 400이다

#### Scenario: 제목은 80자까지이고 서로게이트 쌍을 가르지 않는다

- **WHEN** 79자 뒤에 그림 문자(서로게이트 쌍)가 오는 제목 블록으로 미리보기를 부른다
- **THEN** 제안 제목이 앞 79자이고 짝 없는 서로게이트가 없다

#### Scenario: 세션 없이 부르면 401이다

- **WHEN** 세션 쿠키 없이 맞는 markdown으로 미리보기를 부른다
- **THEN** 401이다

### Requirement: 미리보기 요청 본문은 크기 상한이 있다

`POST /api/import/preview`는 SHALL 요청 본문이 markdown 상한의 4배 바이트를 넘으면 읽기 전에 413과 크기 문장을 돌려준다.

#### Scenario: 본문 상한을 넘긴 미리보기는 413이다

- **WHEN** 세션을 가진 채 본문 상한을 넘긴 본문으로 부른다
- **THEN** 413 · 크기 문장이고 계약의 413 스키마를 따른다
