#!/usr/bin/env bash
# Stop: 코드가 바뀐 턴만 commands.verify(.claude/cgamja.json). 실패하면 오류 줄 요약 + 마지막 50줄과 함께 block.
# handoff(adr/0017): 에이전트가 고칠 수 없는 빨강(보호 파일·환경)은 .claude/state/handoff 에 이유를 쓰면 1회 통과 — 조용히가 아니라 시끄럽게(사유가 출력·로그에 남는다).
source "$(dirname "$0")/_lib.sh"
[ "$(j stop_hook_active)" = "true" ] && exit 0
cd "$ROOT" 2>/dev/null || exit 0
verify="$(cfg commands.verify)"; [ -z "$verify" ] && { echo "[stop] commands.verify 선언 없음 — 완료 정의가 없습니다(/develop-setup)" >&2; exit 0; }
changed="$( { git diff --name-only; git diff --cached --name-only; git ls-files --others --exclude-standard; } 2>/dev/null | grep -vE '^(openspec|docs|design)/|\.md$' || true)"
[ -z "$changed" ] && exit 0
if [ -f .claude/state/handoff ]; then
  reason="$(head -c 500 .claude/state/handoff)"; rm -f .claude/state/handoff
  echo "[stop] verify 미해결 상태로 사용자에게 넘김: ${reason:-사유 없음} — 로그 .claude/state/verify.last.log" >&2; exit 0; fi
if git diff --name-only 2>/dev/null | grep -qE "$(cfg protected | globs_to_regex)"; then
  echo "[stop] 보호 파일(의존성·설정)이 바뀌었습니다 — 사용자 확인이 필요합니다." >&2; fi
out="$(bash -c "$verify" 2>&1)"; code=$?
mkdir -p .claude/state; { echo "# $(date -u +%FT%TZ) \`$verify\` exit $code"; echo "$out" | tail -200; } > .claude/state/verify.last.log   # 증거 보존(리뷰 2축 — review-cgamja·code-review — 이 읽는다). 커밋하지 않는다(.gitignore)
[ $code -eq 0 ] || {
  echo "[stop] \`$verify\` 실패 — 고치기 전엔 끝난 게 아닙니다. 원인 줄:" >&2
  grep -inE 'error|fail|✗|✖' <<<"$out" | head -15 >&2
  echo "— 전체는 .claude/state/verify.last.log · 마지막 50줄:" >&2; echo "$out" | tail -50 >&2
  echo "에이전트가 고칠 수 없는 원인(보호 파일·환경)이면 이유 한 줄을 .claude/state/handoff 에 쓰고 멈춰 사용자에게 알려라(다음 Stop 1회 통과, 사유는 기록에 남는다)." >&2
  exit 2; }
exit 0
