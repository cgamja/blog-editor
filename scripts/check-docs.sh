#!/usr/bin/env bash
# scripts/check-docs.sh — CLAUDE.md / .claude/rules / docs/conventions.md 가 가리키는 경로와 명령이 실제로 있는지. 문서 rot 방지.
# (템플릿 대비 수정: grep 무일치 + pipefail로 조용히 죽던 것, while-서브셸에서 fail=1이 전파되지 않던 것 — 2026-08-21)
set -uo pipefail
fail=0
files=(CLAUDE.md docs/conventions.md docs/adr/0001-domain-structure.md)
for f in .claude/rules/*.md; do [ -e "$f" ] && files+=("$f"); done

# 1) 백틱 안의 경로 (src/, docs/, design/, openspec/, .claude/, test/, e2e/, scripts/ 로 시작, 글롭·플레이스홀더 제외)
for f in "${files[@]}"; do
  paths="$(grep -oE '`(src|docs|design|openspec|\.claude|test|e2e|scripts)/[^`*<>{}]+`' "$f" 2>/dev/null | tr -d '`' | sort -u || true)"
  for p in $paths; do
    p="${p%/}"
    if [ ! -e "$p" ]; then echo "✗ $f → 없는 경로: $p"; fail=1; fi
  done
done

# 2) 백틱 안의 `pnpm <script>` 가 package.json scripts에 있는지
for f in "${files[@]}"; do
  scripts="$(grep -oE '`(pnpm|npm run|yarn|bun) [a-z:-]+`' "$f" 2>/dev/null | awk '{print $2}' | tr -d '`' | sort -u || true)"
  for s in $scripts; do
    case "$s" in dev|add|exec|install) continue;; esac
    if ! grep -qE "\"$s\"[[:space:]]*:" package.json; then echo "✗ $f → package.json scripts에 없음: $s"; fail=1; fi
  done
done

# 3) CLAUDE.md 에 eager import 없음
if grep -qE '(^|[[:space:]])@[A-Za-z./_-]+' CLAUDE.md; then echo "✗ CLAUDE.md 에 @import 있음(eager 로딩). 백틱 포인터로 바꾸세요"; fail=1; fi

# 4) CLAUDE.md 길이
n=$(wc -l < CLAUDE.md); [ "$n" -gt 80 ] && echo "⚠ CLAUDE.md ${n}줄 (목표 ≤60)"

[ $fail -eq 0 ] && echo "docs OK"
exit $fail
