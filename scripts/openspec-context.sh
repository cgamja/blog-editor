#!/usr/bin/env bash
# openspec/config.yaml 을 .claude/cgamja.json(선언)에서 생성한다 — 같은 사실을 손으로 두 번 쓰지 않는다(adr-010).
#   scripts/openspec-context.sh          생성해서 덮어쓴다
#   scripts/openspec-context.sh --check  생성 결과와 커밋된 파일이 같은지만 본다(파일을 바꾸지 않는다). verify가 돈다 — 선언만 바꾸고 재생성을 잊으면 빨강.
# 스택 · 규칙의 원문은 CLAUDE.md / adr/ 이고 여기서는 가리키기만 한다.
set -euo pipefail
cd "$(dirname "$0")/.."
out="$(mktemp)"; trap 'rm -f "$out"' EXIT
python3 - "$out" <<'PY'
import json, sys
d = json.load(open(".claude/cgamja.json"))
c, t, dm, pl = d["commands"], d["tests"], d["domains"], d["platform"]
edges = "\n".join(f"    - {e}" for e in dm["allowed_edges"])
null_slots = [k for k in ("contract",) if d.get(k) is None] + [
    f"{g}.{k}" for g in ("mock", "design", "a11y") for k, v in d[g].items() if v is None
]
ctx = f"""  Read CLAUDE.md first (rules, structure, what not to do) and adr/ for decisions.
  Stack: pnpm monorepo, TypeScript strict, zod (content-schema), Vitest node (no DOM).
  Units: workspace packages under {dm["root"]}/ and {dm["apps"]}/. Import between packages only as
  @blog-editor/<name>; allowed edges (eslint-enforced, adr-009):
{edges}
  Tests: patterns {t["patterns"]}; layers {json.dumps(t["layers"])}. Test file edits are gated
  (red gate) and go in test: commits before feat: commits.
  Verify (definition of done): `{c["verify"]}`. Platform: {pl["profile"]}.
  Design source: {d["design"]["source"]} (node index: design/map.md). Not yet declared (null): {", ".join(null_slots)}.
  No new dependencies without the LIBRARY gate + ADR. Conventional commits in Korean, subject <= 50 chars.
  Security/data invariants never weakened: drafts never on public API, 409 on stale revision,
  URL scheme allow-list, MCP tokens cannot publish.
"""
text = f"""# 생성 파일 — 손으로 고치지 않는다. 원천은 .claude/cgamja.json + CLAUDE.md, 생성은 scripts/openspec-context.sh (adr-010)
schema: feature # 기본 스키마 = Tier-2 (delta spec + tasks)
context: |
{ctx}rules:
  specs:
    - One capability per file; keep under 80 lines
    - Scenarios must be observable (what the user or the API caller sees), not implementation
    - Korean prose; put SHALL in the first sentence of each Requirement (strict validation)
  tasks:
    - Max 8 tasks per change; if more, split the change
operations:
  apply:
    guidance:
      - Commit per stage (test(scope) before feat(scope)); tests in a separate commit before implementation
      - Editor behavior tasks (selection · IME · NodeView) list a manual real-browser check in the PR
      - Run `pnpm verify` before marking the last task complete
  archive:
    guidance:
      - Before archiving run the two review axes (cgamja:review-cgamja for philosophy/spec compliance, code review for bugs). Resolve blockers first (one batched fix pass, one recheck).
      - Confirm every `#### Scenario:` has a matching test or screenshot (Converge group) before archive
"""
open(sys.argv[1], "w").write(text)
PY
# 커밋된 파일은 prettier 포맷을 거치므로 생성물도 같은 포맷으로 맞춘 뒤 비교한다
pnpm exec prettier --log-level warn --stdin-filepath openspec/config.yaml < "$out" > "$out.fmt" && mv "$out.fmt" "$out"
if [ "${1:-}" = "--check" ]; then
  if diff -u openspec/config.yaml "$out"; then echo "openspec/config.yaml 최신"; else
    echo "✗ openspec/config.yaml 이 선언(.claude/cgamja.json)과 다르다 — scripts/openspec-context.sh 를 돌려 재생성하고 커밋" >&2; exit 1; fi
else
  cp "$out" openspec/config.yaml; echo "openspec/config.yaml 생성"
fi
