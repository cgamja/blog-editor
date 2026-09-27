## ADDED Requirements

### Requirement: 블록을 나눠도 간격은 앞 조각에만 남는다

`splitBlockKeepingDecoration`(Enter, 옛 이름 `splitBlockKeepingStickers`)은 SHALL 간격(`space`)이 있는 텍스트 블록도 나누고, 간격은 어디서 나누든 앞 조각에만 남긴다 — 간격은 원래 블록 위 자리라서 맨 앞에서 나누면 빈 앞 조각이 갖고, 글이 남은 뒤 조각은 간격이 없다. 스티커 규칙은 그대로다(가운데 · 끝이면 앞, 맨 앞이면 글이 남은 뒤 조각). 스티커도 간격도 없는 블록 · 코드 블록은 false로 코어 Enter에 넘긴다.

#### Scenario: 가운데 · 맨 앞에서 나누기

- **WHEN** `space: lg` 문단 「가나」의 가운데 또는 맨 앞에서 나눈다
- **THEN** 블록이 둘이 되고 앞 조각만 `space: lg`, 뒤 조각은 `space`가 없으며 저장 가능하다

#### Scenario: 간격 · 스티커 문단 맨 앞에서 나누기

- **WHEN** `space: lg`와 스티커가 있는 문단 맨 앞에서 나눈다
- **THEN** 앞(빈) 조각은 `space: lg`만, 글이 남은 뒤 조각은 스티커만 갖는다

## MODIFIED Requirements

### Requirement: 블록을 나눠도 스티커는 한 블록에만 남는다

스티커가 있는 블록에서 Enter를 누르면 SHALL 순수 커맨드 `splitBlockKeepingDecoration(state, dispatch)`가 한 트랜잭션에서 블록을 나누고 스티커를 한 블록에만 둔다. 가운데나 끝에서 나누면 원래(앞) 블록에 남는다. 맨 앞에서 나누면 글이 남은 뒤 블록에 남고, 새로 생긴 빈 앞 블록에는 없다. 글꼴 · 움직임 · 폭은 이어 쓰는 블록이 같은 모양이도록 양쪽에 남는다. 스티커를 복제하면 문서 전체 스티커 수가 늘어 상한(`MAX_STICKERS_PER_DOC`)을 넘고, blockGuard가 Enter 트랜잭션을 조용히 거부한다. 코드 블록 안이거나 스티커도 간격도 없는 블록, 나눌 수 없는 자리에서는 dispatch 없이 false를 돌려주어 코어 Enter(코드 블록은 줄바꿈)에 넘긴다.

#### Scenario: 가운데에서 나누면 스티커는 앞 블록에만 있다

- **WHEN** 스티커 · 글꼴(`jua`)이 있는 최상위 문단 가운데에서 `splitBlockKeepingDecoration`를 부른다
- **THEN** 앞 블록에만 스티커가 있고 뒤 블록에는 없으며, 글꼴은 양쪽에 있고, 결과 문서가 `docFromNode`를 통과한다

#### Scenario: 맨 앞에서 나누면 스티커는 글이 남은 뒤 블록에 있다

- **WHEN** 스티커가 있는 문단과 제목의 맨 앞에서 각각 `splitBlockKeepingDecoration`를 부른다
- **THEN** 두 경우 모두 새로 생긴 빈 앞 블록에는 스티커가 없고 글이 남은 뒤 블록에 스티커가 있으며, 결과 문서가 `docFromNode`를 통과한다

#### Scenario: 코드 블록 안에서는 나누지 않고 넘긴다

- **WHEN** 스티커가 있는 코드 블록 안에서 `splitBlockKeepingDecoration`를 부른다
- **THEN** false를 돌려주고 dispatch하지 않는다
