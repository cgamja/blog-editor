# post-store Specification

## Purpose

글 파일을 읽고 쓰는 저장소 계약(plan 3-6 `PostStore`). 구현(Memory · File, M4의 S3)은 모두 같은 계약 스위트를 통과한다 — 로컬 우선 개발(adr-004 · D12)의 안전장치다.

## Requirements

### Requirement: 저장소는 slug로 글 파일과 revision을 주고받는다

저장소는 SHALL `get(slug)` · `put(slug, file, revision)` · `list()` 세 동작을 가진다. `get`은 없으면 `null`, 있으면 `{ file, revision }`을 준다. `put`은 새 revision을 돌려준다. `list`는 저장된 모든 글의 `{ slug, meta }`를 준다. revision은 저장소가 정하는 불투명 문자열이고 내용이 바뀌면 반드시 바뀐다.

#### Scenario: 새 글을 쓰고 다시 읽는다

- **WHEN** 없는 slug `beta-open`에 revision `null`로 픽스처 글을 쓰고 `get("beta-open")`을 부른다
- **THEN** 쓴 글과 같은 `file`과 `put`이 돌려준 것과 같은 `revision`이 나오고, `list()`에 `beta-open`이 있다

#### Scenario: 없는 글은 null이다

- **WHEN** 한 번도 쓰지 않은 slug로 `get`을 부른다
- **THEN** `null`이 나온다

### Requirement: revision이 어긋난 쓰기는 거부되고 저장된 글은 그대로다 (보호 대상 — 고쳐서 통과시키지 않는다)

`put`은 SHALL 넘겨받은 revision이 현재 revision과 다르면 `ConflictError`를 던지고 아무것도 바꾸지 않는다. 있는 글에 `null`(새 글로 쓰기) · 없는 글에 revision · 낡은 revision이 모두 어긋난 경우다.

#### Scenario: 낡은 revision으로 쓰면 충돌이다

- **WHEN** 글을 revision `r1`로 한 번 고친 뒤(현재 `r2`) 다시 `r1`로 다른 내용을 쓴다
- **THEN** `ConflictError`가 나고 `get`은 여전히 `r2`의 내용을 준다

#### Scenario: 있는 글에 새 글로 쓰거나 없는 글에 revision을 주면 충돌이다

- **WHEN** 있는 slug에 `null`로, 없는 slug에 아무 revision으로 각각 쓴다
- **THEN** 둘 다 `ConflictError`이고 저장소 내용은 바뀌지 않는다

#### Scenario: 같은 revision으로 동시에 쓰면 하나만 성공한다

- **WHEN** 같은 현재 revision으로 서로 다른 내용의 `put` 두 개를 동시에 시작한다
- **THEN** 정확히 하나만 성공하고 다른 하나는 `ConflictError`이며, 저장된 내용은 성공한 쪽이다

### Requirement: 파일 저장소는 워크스페이스 경로에 남고 다시 열어도 같다

파일 저장소는 SHALL 글을 `<root>/workspaces/<workspaceId>/posts/<slug>.json`에 쓰고, revision은 저장된 내용의 해시다. 새 저장소 인스턴스로 같은 루트를 열면 같은 글과 같은 revision을 읽는다.

#### Scenario: 저장소를 다시 열어도 글과 revision이 같다

- **WHEN** 파일 저장소에 글을 쓴 뒤 같은 루트로 새 저장소를 만들어 `get`한다
- **THEN** 같은 `file`과 같은 `revision`이 나오고 파일은 `workspaces/<id>/posts/<slug>.json`에 있다

실패 의미론: 응답 유실 후 재시도는 API 층(posts-api)에서 다룬다. 동시 입력은 위 동시 쓰기 시나리오. 수명(만료)은 해당 없음.
