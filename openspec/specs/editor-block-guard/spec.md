# editor-block-guard Specification

## Purpose

편집 중 문서가 닫힌 집합(content-schema)을 벗어나지 않게 막는 blockGuard 플러그인 — 규칙은 docFromNode(zod)를 재사용하고, 거부만 하며 문서를 스스로 고치지 않는다(IME · `view.composing` 안전).

## Requirements

### Requirement: 편집 중에도 문서는 닫힌 집합을 벗어나지 않는다

`@blog-editor/editor-core`는 SHALL ProseMirror 플러그인 `blockGuard()`를 export한다. 문서를 바꾸는 트랜잭션의 결과가 content-schema `docSchema`를 어기면(안쪽 노드의 꾸미기 · 문서 전체 스티커 상한 · attrs 값 범위 등) 그 트랜잭션은 적용되지 않고 상태가 그대로 남는다. 규칙은 `docFromNode`를 재사용한다 — 플러그인에 규칙을 다시 적지 않는다. 이 플러그인은 문서를 고치지 않고 거부만 한다.

#### Scenario: 최상위 블록의 꾸미기는 그대로 적용된다

- **WHEN** 최상위 문단에 `font`를 설정하는 트랜잭션을 적용한다
- **THEN** 결과 문서의 그 문단에 `font`가 있다

#### Scenario: 안쪽 노드의 꾸미기는 거부된다

- **WHEN** 인용 안 문단에 `font`를 설정하는 트랜잭션을 적용한다
- **THEN** 상태의 문서가 적용 전과 같다

#### Scenario: 스티커 상한을 넘기는 변경은 거부된다

- **WHEN** 스티커가 12개인 문서에서 다른 블록에 스티커 하나를 더한다
- **THEN** 상태의 문서가 적용 전과 같다

#### Scenario: 범위 밖 attrs 값은 거부된다

- **WHEN** 이미지의 `width`를 범위 밖(10)으로 설정한다
- **THEN** 상태의 문서가 적용 전과 같다

### Requirement: 조합 입력은 위반을 만들지 않고, 에디터를 얼리지 않는다

`blockGuard()`는 SHALL 조합 입력에 면제 분기를 두지 않는다 — 조합(IME) 트랜잭션도 같은 판정을 지나며, 텍스트 입력은 유효한 문서를 위반으로 만들 수 없어서 통과한다. 또 적용 전 문서가 이미 닫힌 집합 밖이면 트랜잭션을 거부하지 않는다(가드가 꺼진다). 이 전제는 **에디터의 초기 문서를 반드시 `docToNode`로 만든다**는 것이다(editor-react) — 그래서 무효 문서는 정상 경로로 에디터에 들어오지 않고, 들어왔다면 모든 편집을 막아 에디터가 얼기보다 저장 경계 `docFromNode`가 거부하게 둔다.

#### Scenario: 조합 입력은 위반을 만들 수 없어 그대로 적용된다

- **WHEN** `composition` meta가 붙은 텍스트 삽입 트랜잭션을 적용한다
- **THEN** 결과 문서에 그 텍스트가 있다(면제가 아니라 판정을 통과한 것이다)

#### Scenario: 블록 경계를 넘는 선택을 조합 입력으로 바꿔도 결과는 닫힌 집합 안이다

- **WHEN** 최상위 문단에서 인용 안 문단까지 걸친 선택을 `composition` meta가 붙은 텍스트로 바꾼다
- **THEN** 결과 상태의 문서가 `docFromNode`를 통과한다(결과가 유효하면 적용, 무효면 거부 — 어느 쪽이든 상태는 닫힌 집합 안)

#### Scenario: 이미 벗어난 문서에서도 편집할 수 있다

- **WHEN** 안쪽 문단에 꾸미기가 있는 상태(`docToNode`를 거치지 않고 만든 노드)에서 텍스트를 삽입한다
- **THEN** 결과 문서에 그 텍스트가 있다
