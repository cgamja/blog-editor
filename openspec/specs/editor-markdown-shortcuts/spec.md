# editor-markdown-shortcuts Specification

## Purpose

Notion처럼 타이핑으로 서식을 바꾼다 — 줄 맨 앞 입력 규칙(목록 · 제목 · 인용 · 코드 블록 · 구분선)과 인라인 마크 규칙, 서식 · 블록 바꾸기 · 복제 단축키, 허용 목록으로 거르는 링크 커맨드. 블록 변환은 꾸미기를 들고 가서 blockGuard를 통과한다(이슈 #70).

## Requirements

### Requirement: 줄 맨 앞 입력 규칙이 블록을 바꾼다

editor-core는 SHALL `markdownShortcutPlugins()`와 `MarkdownShortcuts` 확장을 export하고, 커서가 최상위 문단 맨 앞일 때 다음 입력을 블록으로 바꾼다: `- `·`* `·`+ ` → 점 목록, `1. ` → 번호 목록, `# `·`## ` → 큰 제목(h2), `### ` → 작은 제목(h3), `" `·`> ` → 인용, ` ``` ` → 코드 블록, `--`만 있는 문단의 `-` → 구분선과 그 뒤 새 문단. 표시 글자는 문서에 남지 않고, 결과는 blockGuard를 통과한다.

#### Scenario: 목록 규칙

- **WHEN** 빈 최상위 문단에서 `- ` · `* ` · `+ ` · `1. `를 입력한다
- **THEN** 앞 셋은 점 목록, `1. `은 번호 목록의 첫 항목 문단이 되고 표시 글자는 없다

#### Scenario: 제목 규칙

- **WHEN** 빈 최상위 문단에서 `# ` · `## ` · `### `를 입력한다
- **THEN** 앞 둘은 level 2, `### `는 level 3 제목이 된다

#### Scenario: 인용 · 코드 블록 규칙

- **WHEN** 빈 최상위 문단에서 `" ` · `> ` · ` ``` `를 입력한다
- **THEN** 앞 둘은 인용 안 문단, ` ``` `는 코드 블록이 된다

#### Scenario: 구분선 규칙

- **WHEN** `--`만 있는 최상위 문단 끝에서 `-`를 입력한다
- **THEN** 그 자리에 구분선이 있고 바로 뒤 빈 문단에 커서가 있다

#### Scenario: 꾸미기가 있는 문단을 목록으로 바꾼다

- **WHEN** font · 스티커가 있는 빈 문단에서 blockGuard를 단 채로 `- `를 입력한다
- **THEN** 점 목록이 그 font · 스티커를 갖고, 트랜잭션이 거부되지 않는다

#### Scenario: 코드 블록으로 바꾸면 가질 수 없는 꾸미기만 떨어진다

- **WHEN** font · 스티커가 있는 빈 문단에서 ` ``` `를 입력한다
- **THEN** 코드 블록은 스티커를 갖고 font는 없다

#### Scenario: 목록 항목 안에서는 블록 규칙이 걸리지 않는다

- **WHEN** 점 목록 항목 문단 맨 앞에서 `- `를 입력한다
- **THEN** 규칙이 처리하지 않는다(글자가 평범하게 들어갈 자리)

### Requirement: 인라인 입력 규칙이 마크를 건다

`**글자**` · `*글자*` · `` `글자` ``의 닫는 표시를 입력하면 SHALL 표시 글자를 지우고 굵게 · 기울임 · 코드 마크를 건다. 이어 치는 글자에는 그 마크가 붙지 않는다. 코드 블록 안에서는 걸지 않는다.

#### Scenario: 마크 규칙

- **WHEN** 문단에 `앞**굵게*`를 두고 `*`를 입력한다(기울임 · 코드도 같은 방식)
- **THEN** 글자는 `앞굵게`이고 `굵게`에만 bold 마크가 있고 저장된 마크가 없다

#### Scenario: 코드 블록 안에서는 걸지 않는다

- **WHEN** 코드 블록에서 `**a*` 뒤에 `*`를 입력한다
- **THEN** 규칙이 처리하지 않는다

### Requirement: 조합 중에는 규칙이 걸리지 않고, 규칙 직후 Backspace는 되돌린다

뷰가 조합 중(`composing`)이면 SHALL 규칙이 처리하지 않는다. 규칙이 걸린 직후 Backspace는 `undoInputRule`로 입력한 글자 그대로 되돌린다.

#### Scenario: 조합 중

- **WHEN** 조합 중인 뷰에서 빈 문단에 `- `를 입력한다
- **THEN** 규칙이 처리하지 않고 문서는 그대로다

#### Scenario: Backspace 되돌리기

- **WHEN** `- ` 규칙이 걸린 직후 Backspace 키맵을 부른다
- **THEN** 문서는 `- ` 글자가 든 문단이다

### Requirement: 서식 · 블록 바꾸기 · 복제 단축키

`markdownShortcutKeymap`은 SHALL `Mod-b` · `Mod-i` · `Mod-e`로 굵게 · 기울임 · 코드를 켜고 끄고, `Mod-Alt-0` 문단 · `Mod-Alt-1`·`Mod-Alt-2` 큰 제목 · `Mod-Alt-3` 작은 제목 · `Mod-Alt-5` 점 목록 · `Mod-Alt-6` 번호 목록 · `Mod-Alt-8` 코드 블록으로 바꾸고, `Mod-d`로 커서가 든 최상위 블록을 바로 뒤에 복제한다. 복제로 문서 스티커 수가 상한을 넘으면 `duplicateTopBlock`은 `false`이고, `Mod-d`는 키를 삼켜(`true`) 브라우저 기본 동작(북마크)이 뜨지 않는다. 여러 줄 코드 블록을 문단으로 바꾸면 줄마다 문단 하나가 되고, 제목으로는 바꾸지 않는다(`false`).

#### Scenario: 서식 단축키

- **WHEN** 글자를 고르고 `Mod-b` · `Mod-i` · `Mod-e`를 부른다
- **THEN** 각각 bold · italic · code 마크가 그 글자에 걸린다

#### Scenario: 블록 바꾸기 단축키

- **WHEN** 문단에서 `Mod-Alt-2` · `Mod-Alt-3` · `Mod-Alt-5` · `Mod-Alt-6` · `Mod-Alt-8`을, 제목에서 `Mod-Alt-0`을 부른다
- **THEN** 큰 제목 · 작은 제목 · 점 목록 · 번호 목록 · 코드 블록 · 문단이 된다

#### Scenario: 블록 복제

- **WHEN** 둘째 문단에서 `Mod-d`를 부른다
- **THEN** 같은 문단이 바로 뒤에 하나 더 있고 커서는 복제본 안이다

#### Scenario: 스티커 상한을 넘는 복제

- **WHEN** 스티커가 12개인 문서에서 스티커가 있는 블록을 복제한다
- **THEN** `duplicateTopBlock`은 `false`, `Mod-d`는 `true`(키를 삼킨다)이고 문서는 그대로다

#### Scenario: 여러 줄 코드 블록을 문단으로

- **WHEN** 두 줄짜리 코드 블록에서 `Mod-Alt-0`을 부른다
- **THEN** 줄마다 문단 하나, 문단 둘이 된다

#### Scenario: 여러 줄 코드 블록을 제목으로

- **WHEN** 두 줄짜리 코드 블록에서 `Mod-Alt-2`를 부른다
- **THEN** `false`이고 문서는 그대로다

### Requirement: 링크는 허용 목록 주소로만 건다

`setLink(href)`는 SHALL content-schema `hrefSchema`를 통과하는 주소일 때만 고른 글자(또는 커서가 든 링크 전체)에 link 마크를 걸고, 어기거나 고른 글자가 없으면 `false`다. `removeLink`는 고른 글자 · 커서가 든 링크에서 마크를 뺀다.

#### Scenario: 허용 주소

- **WHEN** 글자를 고르고 `setLink("https://example.com")`을 부른다
- **THEN** 그 글자에 href가 그 주소인 link 마크가 있다

#### Scenario: 허용 목록 밖 주소

- **WHEN** 글자를 고르고 `setLink("javascript:alert(1)")`을 부른다
- **THEN** `false`이고 문서는 그대로다

#### Scenario: 링크 빼기

- **WHEN** 링크 안에 커서를 두고 `removeLink`를 부른다
- **THEN** 그 링크 글자 전체에 link 마크가 없다

### Requirement: 인라인 규칙은 선택 · 단어 안 · 조합 끝에서도 맞게 동작한다

인라인 마크 규칙은 SHALL 글자를 고른 채 입력할 때는 처리하지 않고, 여는 `*` 바로 앞 글자가 라틴 문자 · 숫자면(`2*3*` · `a*b*`) 처리하지 않는다. 한글 뒤에 붙여 쓴 경우(`정말*중요*`)는 처리한다. 조합이 끝난 뒤 다시 보는 경로(입력 글자 없이 커서 앞 글자만 보는 경우)에서도 표시 글자가 남지 않는다.

#### Scenario: 고른 글자가 있을 때

- **WHEN** 글자를 고른 채로 닫는 `*`를 입력한다
- **THEN** 규칙이 처리하지 않는다

#### Scenario: 라틴 문자 · 숫자 안의 `*`

- **WHEN** `2*3` · `a*b` 뒤에 `*`를 입력한다
- **THEN** 기울임이 걸리지 않는다

#### Scenario: 한글 뒤에 붙여 쓴 `*`

- **WHEN** `정말*중요` 뒤에 `*`를 입력한다
- **THEN** `중요`에 기울임이 걸리고 글자는 `정말중요`다

#### Scenario: 조합이 끝난 뒤

- **WHEN** `앞**굵게**`가 조합으로 다 들어간 뒤 조합이 끝난다
- **THEN** 글자는 `앞굵게`이고 `굵게`에 굵게가 걸린다

### Requirement: 링크 대상 조회

`linkHrefAt(state)`는 SHALL 고른 글자 안의 첫 link 마크 주소(커서면 커서 자리 마크의 주소)를, `hasLinkTarget(state)`는 고른 글자가 있거나 커서가 링크 안이면 `true`를 돌려준다.

#### Scenario: 링크 글자를 정확히 고른다

- **WHEN** 링크 글자를 정확히 고르고 `linkHrefAt`을 부른다
- **THEN** 그 링크 주소다

#### Scenario: 걸 대상

- **WHEN** 링크 밖 커서 · 고른 글자 · 링크 안 커서에서 `hasLinkTarget`을 부른다
- **THEN** 차례로 `false` · `true` · `true`다
