## ADDED Requirements

### Requirement: 가져오기 미리보기는 변환 결과만 돌려주고 저장하지 않는다

`POST /api/import/preview`는 SHALL `{ markdown }`을 변환 코어로 바꿔, 성공하면 `{ ok: true, doc, html, suggested: { title, description } }`를, 실패하면 `{ ok: false, messages }`를 200으로 돌려준다. `doc`은 정규형, `html`은 공개 렌더러 결과, 제안은 첫 제목 블록과 첫 문단의 글자(설명은 160자까지)다. 어느 경우에도 글 저장소를 바꾸지 않는다. 본문이 JSON이 아니거나 `markdown`이 문자열이 아니거나 상한보다 길면 400이다.

#### Scenario: 맞는 markdown이면 변환 결과와 제안이 온다

- **WHEN** 제목 블록과 문단이 있는 markdown으로 미리보기를 부른다
- **THEN** `ok: true`이고 doc이 문서 스키마를 통과하고, html에 그 문단이 있고, 제안 제목 · 설명이 첫 제목 · 첫 문단이며, 글 목록은 비어 있다

#### Scenario: 틀린 markdown이면 줄 번호 메시지가 온다

- **WHEN** 지원하지 않는 블록(표)이 든 markdown으로 미리보기를 부른다
- **THEN** `ok: false`이고 메시지에 그 줄 번호가 있으며, 글 목록은 비어 있다

#### Scenario: 틀린 요청은 400이다

- **WHEN** JSON이 아닌 본문, `markdown`이 없는 본문, 상한보다 긴 markdown으로 부른다
- **THEN** 모두 400이다
