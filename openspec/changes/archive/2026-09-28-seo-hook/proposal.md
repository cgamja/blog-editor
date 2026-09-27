# seo-hook (이슈 #149)

## Why

`create_draft` · `update_draft` 응답에는 SEO 점검 `seo`가 늘 붙는다(adr-030). 하지만 AI가 응답의 must를 읽고 고칠지는 스킬 규칙(blog-write 3단계)에만 달려 있다. Claude Code에서는 PostToolUse 훅이 저장 직후 응답을 읽어 must를 AI에게 되먹일 수 있다(https://code.claude.com/docs/en/hooks#posttooluse-decision-control). 규칙을 잊어도 must가 남은 채 끝나지 않게 한다.

## What Changes

- `scripts/seo-hook.lib.ts`
  - 순수 함수 `decideSeoHook(input, { attempts })` → `{ action: "block" | "notify" | "pass", message, nextAttempts }`.
  - must가 있고, 그 글에 되먹인 횟수가 3 미만이고, must가 이번 `update_draft` 인자로 AI가 직접 준 글 정보 칸(title · description · keyword)만이 아니면 block이다. 메시지는 must 문구 · 고칠 방법 · `update_draft`로 고치라는 안내 · 발행하지 말라는 말이다. 횟수는 1 늘어난다.
  - must가 상한에 닿았거나 AI가 준 칸뿐이면 알리기만 한다(notify). should · info만이면 알리고 횟수를 0으로 되돌린다.
  - seo가 없으면(`null` · 도구 오류 · 다른 도구) 지나간다(pass).
  - tool_response는 CallToolResult · content 배열 · 파싱된 본문 세 모양을 모두 받는다. MCP 응답 모양은 문서가 정하지 않아서다.
  - 진입점 `main()`은 같은 파일 끝의 가드가 node로 직접 실행될 때만 부른다. stdin을 읽고, 글마다 상태 `.claude/state/seo-hook/<slug>.json`에 횟수를 둔다. block이면 `{"decision":"block","reason"}`, notify면 `{"systemMessage"}`를 낸다. 예외는 삼키고(stderr 한 줄) exit 0이다.
- 훅 등록: `.claude/settings.json` PostToolUse, matcher `mcp__blog-editor__(create|update)_draft`, 명령 `node scripts/seo-hook.lib.ts`. 보호 파일이라 사람이 승인해 넣는다.
- 문서: docs/mcp-connect.md · blog-write SKILL.md의 "#149 예정" 문구를 갱신한다.

## Impact

- 새 의존성은 없다. Node 22.18+의 TS 타입 제거로 돈다(scripts/start.ts · check-css-tokens.ts 선례).
- 문구는 content-schema `SEO_MESSAGES`를 읽지 않고 응답의 message · fix를 그대로 쓴다. 루트는 content-schema에 의존하지 않는다(매니페스트 변경이 필요해서다).
- 하지 않는 것: Codex 훅(장치가 없다. 스킬 규칙이 확인한다) · `check_draft` 되먹임(저장 전 점검은 AI가 직접 부른다) · 발행.
