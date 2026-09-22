#!/usr/bin/env bash
# PostToolUse (Edit|Write): 테스트 파일 편집이 성공했다 = 사람이 첫 ask를 승인했다(또는 이미 승인된 세션이다).
# 세션 마커를 기록해 같은 세션의 이후 테스트 편집은 묻지 않는다(adr/0018). 마커는 .claude/state/(gitignore)에만 남는다.
source "$(dirname "$0")/_lib.sh"
f="$(j tool_input.file_path)"; [ -z "$f" ] && exit 0
rel="${f#"$ROOT"/}"
if matches "$(cfg tests.patterns)" "$rel"; then
  SID="$(j session_id)"; SID="${SID:-nosession}"
  mkdir -p "$ROOT/.claude/state" && touch "$ROOT/.claude/state/red-approved-$SID"
fi
exit 0
