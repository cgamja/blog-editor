## ADDED Requirements

### Requirement: 가져올 파일은 마크다운 확장자와 크기 상한 안만 읽는다

가져오기는 SHALL 고른 파일이 `.md` · `.markdown`(대소문자 무시)이고 크기가 서버 markdown 상한의 4배 바이트(UTF-8 한 글자 최대 4바이트) 이하일 때만 읽는다. 아니면 읽지 않고 그 이유를 보여 준다.

#### Scenario: 확장자 · 크기로 파일을 거른다

- **WHEN** `note.MD`(작음), `note.txt`, 상한을 넘는 `big.md`를 거른다
- **THEN** 차례로 통과 · 확장자 문제 · 크기 문제다
