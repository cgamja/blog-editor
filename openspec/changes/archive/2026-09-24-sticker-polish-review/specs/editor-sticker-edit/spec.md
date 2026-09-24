## MODIFIED Requirements

### Requirement: 끄는 동안 원래 자리의 스티커를 숨긴다

editor-core는 SHALL `stickerHiding()` 플러그인과 `hideSticker(ref | null)` 커맨드를 export한다. 숨긴 스티커가 있으면 그 최상위 블록에 노드 장식 속성 `data-sticker-hidden`(값은 순번, 상수 `STICKER_HIDDEN_ATTR`)을 단다 — ProseMirror가 그린 DOM을 직접 고치지 않는 공식 경로다. 문서는 바꾸지 않고, 문서가 바뀌면(놓기 · 다른 편집) 숨김이 풀린다. 문서를 바꾸지 않는 트랜잭션(선택 이동 등)에서는 그대로다.

#### Scenario: 숨겼다가 풀면 장식이 붙었다 떨어지고 문서는 그대로다

- **WHEN** 스티커 둘인 둘째 문단의 순번 1로 `hideSticker`를 실행하고, 이어서 `hideSticker(null)`을 실행한다
- **THEN** 첫 실행 뒤 둘째 문단 전체에 `data-sticker-hidden="1"` 장식이 하나 있고 문서는 같으며, 둘째 실행 뒤 장식이 없다

#### Scenario: 문서가 바뀌면 숨김이 풀린다

- **WHEN** 스티커를 숨긴 상태에서 그 스티커를 다른 블록으로 옮기는 트랜잭션을 적용한다
- **THEN** 장식이 없다

#### Scenario: 선택만 바뀌면 숨김이 그대로다

- **WHEN** 스티커를 숨긴 상태에서 메타 없이 선택만 옮기는 트랜잭션을 적용한다
- **THEN** 장식이 그대로 하나 있다
