#!/usr/bin/env bash
# PostToolUse (Edit|Write): 편집한 파일만 lint_file.command({file} 치환, .claude/cgamja.json). 전체 타입검사 금지(느림).
source "$(dirname "$0")/_lib.sh"
f="$(j tool_input.file_path)"; [ -f "$f" ] || exit 0
ext="${f##*.}"; cfg lint_file.extensions | grep -qx "$ext" || exit 0
rel="${f#"$ROOT"/}"
matches "$(cfg contract.generated)" "$rel" && exit 0
case "$rel" in openspec/*|node_modules/*) exit 0;; esac
cmdt="$(cfg lint_file.command)"; [ -z "$cmdt" ] && exit 0
cd "$ROOT" 2>/dev/null || exit 0
out="$(bash -c "${cmdt//\{file\}/\"\$1\"}" _ "$f" 2>&1)" || { echo "$out" | tail -30 >&2; exit 2; }   # {file}→"$1": 경로는 인수로, 셸 코드로 재해석하지 않는다
exit 0
