#!/usr/bin/env bash
# cgamja-hooks v3
# PreToolUse (Bash): 훅·검증 우회, 보호 파일·생성물·테스트 파일의 쉘 쓰기 차단. 패턴은 .claude/cgamja.json(adr/0014). permissions.deny와 이중.
# 리다이렉트 패턴은 `2>&1`, `>/dev/null`(fd 리다이렉트)을 제외한다 — 2026-08-21 `cat x.test.tsx 2>&1` 류 읽기 명령 오차단.
# 읽기/쓰기 구분(adr/0017): hooksPath 조회·인터프리터 읽기 실행은 허용, 커밋된 적 없는 스크래치 테스트 rm은 허용.
# 오탐 2차 정밀화(adr/0023): 따옴표 안 문자열은 파일 인자가 아니다(커밋 메시지 속 파일명 오차단), `cat <<` 단독은 stdout이라 쓰기가 아니다(`>` 동반 시 WRITE의 `>`가 잡는다), 쓰기 연산과 대상 경로가 같은 파이프라인 세그먼트에 있을 때만 deny.
# 오탐 3차(adr/0028): 판정 대상을 "명령 텍스트"가 아니라 "명령이 실제로 건드리는 것"으로 좁힌다.
#   (1) heredoc 본문은 데이터다 — 거기 적힌 파일명은 대상이 아니다
#   (2) 모든 리다이렉트(2>&1, >file, >>file)를 걷어낸 뒤에 패키지 인자를 센다 — `npm install 2>&1`이 "lodash 설치"로 읽히던 회귀
#   (3) 프로젝트 루트 밖 절대경로는 이 프로젝트의 보호 대상이 아니다(스크래치패드 작업 오차단)
# 오탐 4차(adr/0031, v3):
#   (4) worktree 사본(`parallel.worktrees` 아래)은 원본이 아니다 — gitignore된 일회용 트리라
#       보호 대상이 아니며, 막으면 adr/0030 이 요구하는 병렬 프로브가 돌지 않는다
# 케이스 표: develop-setup/scripts/hook-cases.sh — 고칠 때 먼저 여기에 케이스를 추가하고 빨강을 본다.
source "$(dirname "$0")/_lib.sh"
cmd="$(j tool_input.command)"; [ -z "$cmd" ] && exit 0

# (1) heredoc 본문 제거: `<<EOF ... EOF` / `<<'EOF' ... EOF`. 구분자 줄 자체도 함께 지운다.
nohere="$(CGAMJA_CMD="$cmd" python3 - <<'PY' 2>/dev/null || printf '%s' "$cmd"
import re,sys,os
c=os.environ.get("CGAMJA_CMD","")
out,i=[],0
lines=c.split("\n")
skip_until=None
for ln in lines:
    if skip_until is not None:
        if ln.strip()==skip_until: skip_until=None
        continue
    m=re.search(r"<<-?\s*(?:'([^']+)'|\"([^\"]+)\"|([^\s;&|<>()'\"]+))", ln)
    if m:
        # 구분자 **전체**를 종료어로 쓴다. 앞부분만 읽으면(`<<END-OF` → `END`) 진짜 종료 줄을
        # 못 만나 그 뒤의 실제 명령까지 heredoc 본문으로 지워진다(PR#10 지적).
        skip_until=m.group(1) or m.group(2) or m.group(3)
        out.append(re.sub(r"<<-?\s*(?:'[^']+'|\"[^\"]+\"|[^\s;&|<>()'\"]+)","",ln,count=1))
        continue
    out.append(ln)
print("\n".join(out))
PY
)"
[ -z "$nohere" ] && nohere="$cmd"

stripped="$(sed -E -e "s/'[^']*'//g" -e 's/"[^"]*"//g' -e 's/[0-9]*>&[0-9]+//g; s/[0-9]*>>?[[:space:]]*\/dev\/null//g' <<<"$nohere")"

# (3) 프로젝트 밖 절대경로 토큰만 지운다 — 다른 곳의 파일은 이 프로젝트의 보호 대상이 아니다.
# **경로 glob 매칭에만** 쓴다: 전체 검사에 적용하면 `git config core.hooksPath /dev/null` 의 인자가
# 사라져 조회처럼 보이고, 리다이렉트 대상이 사라져 `>` 가 인자로 남는다(2026-08-31 실측).
# 토큰을 재조립하지 않고 치환한다 — 재조립하면 인용·구분자가 망가져 진짜 차단이 뚫린다(같은 날 실측).
# 경로 시작을 공백·`>`·`=` 뒤로 한정: `s/a/b/` 같은 sed 표현식 안의 슬래시는 건드리지 않는다.
# (4) worktree 사본은 원본이 아니다(adr/0030·0031). `.claude/worktrees/<slug>/…` 는 gitignore된
# 일회용 트리다 — 거기의 `.env`·설정 파일은 이 프로젝트의 보호 대상이 아니며, 막으면 adr/0030 이
# 요구하는 병렬 프로브 자체가 돌지 않는다(2026-08-31 실측: 프로브의 `.env` 쓰기가 차단됨).
# 절대·상대 양쪽을 지운다 — worktree 경로는 상대로 쓰는 경우가 많아 (3)의 절대경로 규칙에 안 걸린다.
WT="$(cfg parallel.worktrees)"; WT="${WT:-.claude/worktrees}"
pathsafe="$(ROOT="$ROOT" WT="$WT" python3 -c '
import os,re,sys,posixpath
root=os.environ["ROOT"].rstrip("/")
wt=os.environ.get("WT",".claude/worktrees").strip("/")
def norm(p):
    # 완화 판정 전에 ROOT 기준으로 정규화한다. `..` 를 그대로 두면
    # `.claude/worktrees/../../package.json` 이 "worktree 사본"으로 읽혀 지워지고,
    # 셸은 정작 루트의 package.json 을 쓴다(PR#10 지적).
    return posixpath.normpath(p if p.startswith("/") else posixpath.join(root,p))
def outside(p):
    return not (p==root or p.startswith(root+"/"))
def in_worktree(p):
    # 절대/상대 모두: 경로 어딘가에 <worktrees>/ 세그먼트가 있으면 사본이다
    return re.search(r"(?:^|/)"+re.escape(wt)+r"/", p) is not None
def repl(m):
    p=norm(m.group(1))
    return "" if outside(p) or in_worktree(p) else m.group(1)
sys.stdout.write(re.sub(r"(?<![^\s>=])((?:/|\./|[A-Za-z0-9_.-]+/)[^\s\x27\"|;&()]*)", repl, sys.stdin.read()))' <<<"$stripped" 2>/dev/null || printf '%s' "$stripped")"
WRITE='(sed -i|perl -p?i|tee |>|>>|rm |cp |mv |open\([^)]*["'"'"']w)'
# 세그먼트 판정(adr/0023): &&·||·;·|·줄바꿈으로 나눠, 경로($1)와 쓰기 연산이 같은 세그먼트에 있을 때만 참.
# 근사 분할이라 과분할될 수 있으나 과분할은 통과(오탐 감소) 방향으로만 작용한다 — 누락 2회면 전체 매칭 복귀(0023 재검토).
wseg() { local seg; while IFS= read -r seg; do
    grep -qE "$1" <<<"$seg" && grep -qE "$WRITE" <<<"$seg" && return 0
  done < <(sed -E 's/&&|\|\||;|\|/\n/g' <<<"$pathsafe"); return 1; }
if grep -qE -- '--no-verify|git commit[^|]* -n |HUSKY=0|LEFTHOOK=0|push[^|]*(--force|-f )' <<<"$cmd"; then
  deny "[protect] 훅 우회 금지(--no-verify, LEFTHOOK=0, push --force). 막힌 이유를 고치거나 사용자에게 물어라."; fi
# core.hooksPath: 값 설정·-c 인라인만 우회. 조회(git config [--flags] core.hooksPath)는 허용(adr/0017)
if grep -qE 'core\.hooksPath' <<<"$cmd" && ! grep -qE 'git config([[:space:]]+--[a-z-]+)*[[:space:]]+core\.hooksPath[[:space:]]*($|[;&|])' <<<"$stripped"; then
  deny "[protect] core.hooksPath 변경 금지(훅 우회) — 조회(git config core.hooksPath)만 허용."; fi
# 패키지 추가/삭제: 옵션(-D, --save 등)을 걷어낸 뒤 하위명령 뒤에 인자가 남으면 deny(`npm install`/`npm ci`/`pnpm install` 단독은 lockfile 설치라 허용)
# 리다이렉트를 먼저 지운다(adr/0028) — `npm install 2>&1`의 `2>&1`, `npm install > log`의 `> log`가
# 패키지명 인자로 읽혀 훅이 스스로 권장한 복구 경로("인자 없는 install")를 막던 회귀.
# 세그먼트의 **첫 단어**가 패키지 매니저일 때만 본다(adr/0028) — 문자열 안에 적힌 설치 명령
# (`echo "npm install lodash 는 막힌다"`)이 실제 설치로 읽히던 오탐. 따옴표를 지우는 방식은
# `npm install "lodash"` 를 뚫으므로 쓰지 않는다.
pkgadd() { local seg; while IFS= read -r seg; do
    seg="$(sed -E -e 's/^[[:space:]]*//' -e 's/^cd[[:space:]]+[^[:space:]]+[[:space:]]+//' <<<"$seg")"
    # 선행 `NAME=value`·`sudo`·`env` 는 **소비하되 매니저 토큰은 남긴다**(PR#10 지적).
    # 예전 규칙은 두 토큰을 함께 지워 `sudo npm install lodash` → `install lodash` 가 되면서
    # 첫 단어 검사에서 빠져나갔다. `NODE_ENV=production npm …` 은 아예 안 걸렸다.
    while grep -qE '^([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*|sudo|env)[[:space:]]' <<<"$seg"; do
      seg="$(sed -E 's/^([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*|sudo|env)[[:space:]]+//' <<<"$seg")"
    done
    grep -qE '^(pnpm|yarn|bun|npm|npx|pip3?|cargo|go)([[:space:]]|$)' <<<"$seg" || continue
    seg="$(sed -E -e 's/[0-9]*>&[0-9]+//g' -e 's/[0-9]*>>?[[:space:]]*[^ |;&]+//g' -e 's/[[:space:]]--?[A-Za-z][A-Za-z0-9=-]*//g' <<<"$seg")"
    grep -qE '^(pnpm|yarn|bun|npm) +(add|remove|rm|uninstall|un|i|install) +[^ |;&]' <<<"$seg" && return 0
    grep -qE '^(npx +)?expo +install +[^ |;&]' <<<"$seg" && return 0
    grep -qE '^(pip3? +install|cargo +add|go +get) +[^ |;&]' <<<"$seg" && return 0
  done < <(sed -E 's/&&|\|\||;|\|/\n/g' <<<"$nohere"); return 1; }
if pkgadd; then
  deny "[protect] 의존성은 쉘로 바꾸지 않는다 — 매니페스트 Edit를 제안해 사람이 diff를 승인하면(ask) 그다음 인자 없는 install로 lockfile만 동기화(adr/0017)."; fi
# 인터프리터 일회성 실행(node -e / python -c / ruby -e / perl -e): 보호·생성물·테스트 경로 + 쓰기 호출이 함께 있을 때만 deny(읽기 실행은 허용, adr/0017)
if grep -qE '(node|python3?|ruby|perl) +-[ec] ' <<<"$cmd"; then
  allp="$( { cfg protected; cfg contract.generated; cfg tests.patterns; echo '.claude/cgamja.json'; } | globs_to_regex)"
  IWRITE='open\([^)]*["'"'"'](w|a)|write_text|writeFileSync|writeFile|appendFile|\.write\(|unlink|os\.remove|shutil\.|rmtree|renames?\(|truncate\('
  if grep -qE "$allp" <<<"$cmd" && grep -qE "$IWRITE" <<<"$cmd"; then
    deny "[protect] 인터프리터 일회성 실행으로 보호 파일·생성물·테스트 파일을 쓰지 않는다 — Edit 도구를 쓰거나 사용자에게 물어라."; fi
fi
prot="$(cfg protected | globs_to_regex)"
if wseg "$prot"; then
  deny "[protect] 보호 파일(cgamja.json protected)을 쉘로 바꾸지 않는다 — Edit로 제안하면 사람이 diff를 보고 승인한다(adr/0017)."; fi
gen="$(cfg contract.generated | globs_to_regex)"
if [ "$gen" != "^$" ] && wseg "$gen"; then
  deny "[protect] 계약 생성물 — $(cfg contract.source) 을 고치고 \`$(cfg contract.generate)\`."; fi
if grep -qE '(^|[;&| ])TDD_PHASE=' <<<"$cmd"; then
  deny "[tdd] TDD_PHASE는 사람이 세션을 띄울 때 정한다(TDD_PHASE=red claude). 인라인 설정 금지 — red 턴이 필요하면 사용자에게 말하고 멈춰라."; fi
tests="$(cfg tests.patterns | globs_to_regex)"
if wseg "$tests" && [ "${TDD_PHASE:-}" != "red" ]; then
  # 예외(adr/0017): 쓰기 연산이 rm뿐이고, 명령의 테스트 경로가 전부 untracked(커밋된 적 없는 스크래치)면 허용
  if grep -qE '(^|[;&| ])rm ' <<<"$stripped" && ! grep -qE '(sed -i|perl -p?i|tee |>|>>|cp |mv |open\()' <<<"$stripped"; then
    scratch=1
    for tok in $cmd; do tok="${tok#./}"
      case "$tok" in -*|rm|"") continue;; esac
      if matches "$(cfg tests.patterns)" "$tok"; then
        git -C "$ROOT" ls-files --error-unmatch "$tok" >/dev/null 2>&1 && scratch=0
      fi
    done
    [ "$scratch" = 1 ] && exit 0
  fi
  deny "[tdd] 테스트 파일은 쉘로 쓰지 않는다(sed -i/perl -pi/리다이렉트) — 구현 턴엔 읽기전용. 바꿔야 하면 사용자에게 red 턴을 요청해라. (커밋된 적 없는 스크래치 테스트의 rm만 예외)"; fi
exit 0
