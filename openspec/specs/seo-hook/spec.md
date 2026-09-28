# seo-hook Specification

## Purpose

이 레포의 Claude Code에서 blog-editor MCP의 `create_draft` · `update_draft` 직후에 도는 PostToolUse 훅(`scripts/seo-hook.lib.ts`) — 저장 응답의 SEO 결과에 must가 있으면 AI에게 고치라고 되먹인다(글별 3회). 훅은 저장 · 발행을 직접 부르지 않는다(#149, adr-007).

## Requirements

### Requirement: 저장 직후 must를 AI에게 되먹인다

SEO 훅 판정 `decideSeoHook(input, { attempts })`는 SHALL `create_draft` · `update_draft` 응답의 `seo`에 must가 있고, 그 글에 되먹인 횟수가 3 미만이고, must가 이번 `update_draft` 인자로 AI가 직접 준 글 정보 칸(title · description · keyword)만이 아니면 block을 낸다. 메시지에는 must 문구 · 고칠 방법 · `update_draft`로 고치라는 안내가 들어가고, 횟수는 1 늘어난다. tool_response가 CallToolResult · content 배열 · 파싱된 본문 어느 모양이어도 같게 판정한다.

#### Scenario: create_draft 응답에 must가 있으면 되먹인다

- **WHEN** `create_draft` 응답의 seo에 must(image-alt)가 있고 횟수가 0이다
- **THEN** action은 block이고, 메시지에 must 문구 · 고칠 방법 · `update_draft`가 있으며, 횟수는 1이다

#### Scenario: 응답 모양이 달라도 같게 판정한다

- **WHEN** 같은 must 응답을 CallToolResult · content 배열 · 파싱된 본문으로 각각 넣는다
- **THEN** 셋 모두 block이고 횟수는 1이다

### Requirement: 되먹이지 않을 것은 알리기만 하거나 지나간다

판정은 SHALL must가 있어도 횟수가 3에 닿았거나 must가 AI가 이번에 준 칸뿐이면 notify를 내고 횟수를 그대로 둔다. should · info만 있거나 점검이 됐는데 지적이 없으면(seo `[]`) 글이 깨끗해진 것이라 횟수를 0으로 되돌린다(should · info는 notify, `[]`는 pass). seo가 `null`이거나 도구 오류 응답이거나 다른 도구면 pass다. 진입점은 block이면 `{"decision":"block","reason"}`, notify면 `{"systemMessage"}`를 stdout에 내고 pass면 아무것도 내지 않는다. 예외가 나도 exit 0이다. 훅이 작업을 막지 않게 하기 위해서다.

#### Scenario: should만 있으면 알리기만 한다

- **WHEN** 응답의 seo에 should(title-length)만 있다
- **THEN** action은 notify이고 메시지에 그 문구가 있으며, 횟수가 2였어도 0으로 되돌린다

#### Scenario: 상한에 닿으면 더 되먹이지 않는다

- **WHEN** must가 있는 응답이 오고 그 글의 횟수가 3이다
- **THEN** action은 notify이고 횟수는 3이다

#### Scenario: AI가 준 칸만 걸린 must는 되먹이지 않는다

- **WHEN** `update_draft`에 title을 주었고 응답의 must가 title 칸의 duplicate-title뿐이다(횟수 1)
- **THEN** action은 notify이고 횟수는 1 그대로다

#### Scenario: 지적이 없으면 횟수를 되돌린다

- **WHEN** 응답의 seo가 `[]`이고 그 글의 횟수가 2다
- **THEN** action은 pass이고 횟수는 0이다

#### Scenario: 볼 것이 없으면 지나간다

- **WHEN** seo가 `null`인 응답, `isError` 응답, `get_draft` 응답을 각각 넣는다
- **THEN** 셋 모두 pass이고 횟수는 그대로다
