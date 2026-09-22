#!/usr/bin/env bash
# 훅 공통: stdin JSON을 $IN에, 프로젝트 선언(.claude/cgamja.json, adr/0014)을 cfg로 읽는다. source 해서 쓴다.
IN="$(cat)"
j() { printf '%s' "$IN" | python3 -c 'import sys,json
d=json.load(sys.stdin)
for k in sys.argv[1].split("."):
    d=d.get(k) if isinstance(d,dict) else None
print("" if d is None else (d if isinstance(d,str) else json.dumps(d,ensure_ascii=False)))' "$1" 2>/dev/null; }
ROOT="$(j cwd)"; [ -z "$ROOT" ] && ROOT="$PWD"
CFG="$ROOT/.claude/cgamja.json"
cfg() { # $1 dotted key → 문자열 또는 리스트(줄 단위). 선언이 없으면 빈 값(훅은 fail-open이 아니라 '세팅 누락'을 stderr에 남긴다)
  [ -f "$CFG" ] || { echo "[cgamja] $CFG 없음 — /develop-setup 으로 선언 파일을 만든다" >&2; return 0; }
  python3 - "$CFG" "$1" <<'PY' 2>/dev/null
import sys,json
d=json.load(open(sys.argv[1]))
for k in sys.argv[2].split("."):
    d=d.get(k) if isinstance(d,dict) else None
if d is None: print("")
elif isinstance(d,list): print("\n".join(str(x) for x in d))
else: print(d)
PY
}
# glob 목록($1: 줄 단위)에 경로($2, 상대)가 맞는지. ** 지원.
matches() { python3 - "$2" <<PY 2>/dev/null
import sys,fnmatch,re
path=sys.argv[1]; pats="""$1""".split("\n")
def m(p,pat):
    rx=re.escape(pat).replace(r'\*\*/', '(?:.*/)?').replace(r'\*\*', '.*').replace(r'\*', '[^/]*')
    return re.fullmatch(rx, p) is not None or re.fullmatch('(?:.*/)?'+rx, p) is not None
sys.exit(0 if any(m(path,p) for p in pats if p) else 1)
PY
}
# glob 목록을 grep -E 패턴으로(쉘 명령 안의 경로 탐지용): `a/**/*.gen.ts` → `a/.*\.gen\.ts`
globs_to_regex() { python3 -c '
import sys,re
out=[]
for p in sys.stdin.read().split("\n"):
    if not p: continue
    rx=re.escape(p).replace(r"\*\*/", "(?:[^ ]*/)?").replace(r"\*\*", "[^ ]*").replace(r"\*", "[^ /]*")
    out.append(rx)
print("|".join(out) if out else "^$")'; }
deny() { # $1 reason → PreToolUse deny (exit 2 + stderr도 함께: 구버전 호환)
  python3 -c 'import json,sys;print(json.dumps({"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":sys.argv[1]}},ensure_ascii=False))' "$1"
  echo "$1" >&2; exit 2; }
ask() { # $1 reason → PreToolUse ask: 사람이 diff를 보고 승인(대화형). 비대화형(-p)에서는 skip-permissions여도 거부(실측 adr/0009)
  python3 -c 'import json,sys;print(json.dumps({"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":sys.argv[1]}},ensure_ascii=False))' "$1"; exit 0; }
