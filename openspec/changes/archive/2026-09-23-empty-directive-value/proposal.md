# empty-directive-value (이슈 #28)

## Why

`{width=}` · `{size=}`처럼 **알려진 키의 값이 빈** 줄은 지시어 후보에서 빠져서 일반 문단이 되고, 본문에 `{width=}`가 글자로 남는다. 오류 메시지가 없으니 MCP `create_draft`에서 AI가 검증 메시지를 보고 스스로 고치는 구조(adr-007)가 끊긴다. PR #26 CodeRabbit 지적.

## What Changes

- 알려진 키(`frame` · `font` · `motion` · `width` · `size`)가 `키=`(빈 값)이면 그 줄을 지시어 줄로 인식하고, 키별 값 오류로 거부한다 — 모든 키 같은 규칙
- 알 수 없는 키의 빈 값(`{foo=}`) · 모양이 다른 줄(`{size=1200 x800}`)의 판정은 그대로(문단)

## Impact

- `packages/content-convert/src/directives.ts`(후보 판정) · `convert.test.ts` · markdown-directive spec
