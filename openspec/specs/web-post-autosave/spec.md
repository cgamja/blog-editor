# web-post-autosave Specification

## Purpose

편집 화면 자동 저장 시점(입력 멈추고 2초, 조합 중이면 미룸, 저장은 하나씩)과 ⌘S · Ctrl+S 판정(이슈 #97).

## Requirements

### Requirement: 자동 저장은 입력이 멈추고 2초 뒤 한 번, 조합 중이면 미룬다

web은 SHALL `createAutosave({ delayMs, isComposing, save })`로 저장 시점을 정한다. `schedule()`이 불릴 때마다 시계를 다시 맞추고, 시각이 왔을 때 조합 중이면 한 번 더 미룬다. 저장 중에 또 바뀌면 끝난 뒤 한 번 더 저장한다. `flush()`는 기다리지 않고 바로 저장한다.

#### Scenario: 연달아 바뀌어도 멈춘 뒤 한 번

- **WHEN** 1초 간격으로 세 번 `schedule()`하고 2초를 더 기다린다
- **THEN** 저장은 한 번이다

#### Scenario: 조합 중이면 미룬다

- **WHEN** 조합 중인 채로 2초가 지나고, 조합이 끝난 뒤 2초가 더 지난다
- **THEN** 앞 2초에는 저장하지 않고 뒤에 한 번 저장한다

#### Scenario: 저장 중에 또 바뀌면 끝난 뒤 한 번 더

- **WHEN** 저장이 끝나기 전에 `schedule()`하고 저장을 끝낸 뒤 2초를 기다린다
- **THEN** 저장은 두 번이고 겹치지 않는다

#### Scenario: flush는 바로 저장한다

- **WHEN** `schedule()` 직후 `flush()`한다
- **THEN** 기다리지 않고 한 번 저장하고, 2초가 지나도 더 저장하지 않는다

### Requirement: ⌘S · Ctrl+S는 자판 배열과 상관없이 저장이다

web은 SHALL `isSaveShortcut(event)`로 저장 단축키를 판정한다. `code`가 `KeyS`이고 ⌘ 또는 Ctrl만 눌렸으면 저장이다(한글 자판의 `key` "ㄴ"도). Shift · Alt가 함께면 아니다.

#### Scenario: 한글 자판의 ⌘S

- **WHEN** `metaKey`, `code: "KeyS"`, `key: "ㄴ"`인 키를 판정한다
- **THEN** 저장이다

#### Scenario: Shift가 함께면 아니다

- **WHEN** `ctrlKey` · `shiftKey`, `code: "KeyS"`인 키를 판정한다
- **THEN** 저장이 아니다
