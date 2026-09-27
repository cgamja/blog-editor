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
    # 슬래시가 든 glob은 루트 기준(.gitignore 의미, adr/0039) — specs/** 가 openspec/changes/C/specs/ 아래에 걸리지 않게.
    # 슬래시 없는 파일명(package.json)만 어느 폴더에서든 매칭한다. (이 블록은 따옴표 없는 heredoc이라 백틱·달러 기호 금지)
    if re.fullmatch(rx, p): return True
    return "/" not in pat.rstrip("/") and re.fullmatch('(?:.*/)?'+rx, p) is not None
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
# globs_to_regex 결과 중 슬래시가 든 glob(`specs/**`·`.claude/hooks/*`)을 루트 기준으로 고정한다(.gitignore 의미,
# adr/0039) — `openspec/changes/<c>/specs/…`(OpenSpec 델타)가 `specs/**`로 읽히지 않게. 슬래시 없는 파일명
# (`package.json`·`.env`)은 예전처럼 어디서든. 앞에 올 수 있는 것: 줄 시작·경로 밖 글자·ROOT/·`$VAR/`(`$PWD` 등
# 루트를 가리키는 변수)·`../`(루트 안으로 되돌아오는 경로 — 루트 밖이면 pathsafe가 이미 지웠다). 이 둘은 PR#49
# CI 라운드 1 지적(첫 판에서 `$PWD/specs/…`·`docs/../specs/…`가 통과한 회귀).
anchor_rooted() { ROOT="${ROOT:-}" python3 -c '
import os,sys
root=os.environ.get("ROOT","").rstrip("/").replace(".","\\.")
alts_pre=["^","[^A-Za-z0-9_./$}-]",r"\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/",r"(\.\./)+"]
if root: alts_pre.append(root+"/")
pre="("+"|".join(alts_pre)+")(\\./)?"
alts=sys.stdin.read().strip().split("|")
print("|".join(a if (a=="^$" or "/" not in a or a.startswith("(?:") or a.startswith("[^ ]*")) else pre+"("+a+")" for a in alts))'; }
deny() { # $1 reason → PreToolUse deny (exit 2 + stderr도 함께: 구버전 호환)
  python3 -c 'import json,sys;print(json.dumps({"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":sys.argv[1]}},ensure_ascii=False))' "$1"
  echo "$1" >&2; exit 2; }
ask() { # $1 reason → PreToolUse ask: 사람이 diff를 보고 승인(대화형). 비대화형(-p)에서는 skip-permissions여도 거부(실측 adr/0009)
  python3 -c 'import json,sys;print(json.dumps({"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":sys.argv[1]}},ensure_ascii=False))' "$1"; exit 0; }
