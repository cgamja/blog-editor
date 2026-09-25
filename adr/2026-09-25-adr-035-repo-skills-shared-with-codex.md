# ADR-035. 레포 스킬은 원본 하나를 두고 Codex 경로는 심볼릭 링크로 가리킨다

- 날짜: 2026-09-25
- 상태: 제안됨(PR 머지 = 승인)
- 원천: 사용자 2026-09-25 "관련 스킬 등이 코덱스에서도 되지? 어차피 다 똑같은 tool 쓰는데" · 이슈 #156 · adr-007(초안만) · adr-029(AI 이미지는 Codex CLI)

## 문제 (맥락)

블로그 글쓰기 흐름은 MCP 도구 6개와 레포 스킬(`/blog-write`, 이후 `/blog-seo` #150)로 돈다. MCP 도구는 서버 쪽이라 Claude Code든 Codex든 같다.

스킬은 사정이 다르다. 파일 형식은 같다: 폴더 하나에 `SKILL.md`가 있고, 프런트매터에 `name` · `description`이 있다. 그런데 읽는 곳이 다르다.

- **Claude Code:** `.claude/skills/<이름>/`
- **Codex:** `.agents/skills/<이름>/`. 작업 디렉터리부터 레포 루트까지 올라가며 찾는다.
  - 근거: https://learn.chatgpt.com/docs/build-skills
  - 같은 문서에 "Codex supports symlinked skill folders and follows the symlink target when scanning these locations."라고 적혀 있다.

그래서 지금은 Codex에서 `/blog-write`가 보이지 않는다. 그렇다고 두 곳에 복사하면 한쪽만 고쳐지는 일이 생긴다(rot).

## 결정

- **원본은 `.claude/skills/<이름>/`에 둔다.** Codex용 `.agents/skills/<이름>`은 원본을 가리키는 **상대 심볼릭 링크**다(`../../.claude/skills/<이름>`). git은 링크를 링크로 저장한다.
- **링크하는 스킬은 블로그 글쓰기 스킬만이다**(`blog-write`, 이후 `blog-seo`).
  - OpenSpec이 만든 `openspec-*` 스킬은 Claude Code 도구 이름을 전제로 쓰였다.
  - 그래서 Codex 쪽에 링크하지 않는다.
- **테스트가 링크를 지킨다.**
  - Codex 경로가 링크인지 본다.
  - 실제 경로가 원본과 같은지, 내용이 같은지 본다(`blog-write-skill.test.ts`).
- **스킬 문장은 도구 중립으로 쓴다.** 갈리는 단계만 "Claude Code면 … / Codex면 …"으로 나눈다. 갈리는 단계는 다음과 같다.
  - MCP 연결: `/mcp`와 `codex mcp add`
  - 스킬 부르는 법: `/blog-write`와 `$blog-write`
  - 글 품질 채점: claude-seo가 없으면 규칙 결과로 한다.
  - AI 이미지: ADR-029에 따라 Codex는 `$imagegen`, Claude Code는 `codex exec`를 쓴다.
  - 훅이 없는 쪽은 스킬 규칙으로 seo 결과를 확인한다.
- **불변 조건은 스킬이 아니라 서버가 지킨다.** 초안만 쓴다는 것, 발행 도구가 없다는 것은 어느 클라이언트에서든 같다(adr-007).

## 버린 대안

- **두 곳에 복사:** 가장 단순하다. 하지만 한쪽만 고치면 AI마다 다른 규칙을 따르게 된다. 둘이 같은지 보는 테스트를 더하면, 결국 "원본 하나"를 손으로 하는 셈이다.
- **원본을 `.agents/skills`로 옮기고 Claude Code 쪽을 링크:** 방향만 반대이고 효과는 같다. 하지만 기존 경로를 가리키는 곳이 여럿이다: 테스트, 스펙, 문서, Claude Code 사용자 습관. 거기다 `.claude/` 아래가 이 레포 도구 설정의 원천이라는 관례도 깨진다. 옮길 이유가 없다.
- **`.agents/skills` 폴더 전체를 `.claude/skills`로 링크:** 링크가 하나라 편하다. 하지만 OpenSpec 스킬까지 Codex에 노출된다. 그 스킬은 Claude Code 도구를 전제하므로 Codex에서 엉뚱하게 불릴 수 있다.
- **사용자 폴더(`~/.agents/skills`)에 설치:** 레포와 떨어져서 버전이 어긋난다. 다른 기기나 사람이 레포만 받아서는 쓸 수 없다.

## 감수한 트레이드오프

- **Windows에서는 링크가 풀린다.** `core.symlinks`가 꺼져 있으면 링크가 경로 글자를 담은 파일로 풀린다. 그러면 Codex가 스킬을 못 찾고, 링크 테스트가 실패한다. 1단계는 본인용(macOS)이라 감수한다.
- **Claude Code 전용 장치는 Codex에서 빠진다.** 저장 직후 SEO 훅(#149), claude-seo가 그렇다. 스킬 문장의 규칙이 대신하지만 강제력은 약하다. 다만 초안만 쓴다는 불변 조건은 서버가 지키므로 영향이 없다.
- **스킬 문장이 조금 길어진다.** 도구별로 갈리는 곳이 늘 때마다 문장이 는다.

## 재검토 조건

- Claude Code가 `.agents/skills`를 읽게 되거나, 두 도구가 한 경로 표준으로 모일 때 → 링크를 없앤다.
- Windows에서 레포를 쓰는 사람이 생길 때.
- Codex가 링크 폴더 따라가기를 바꿀 때.
- 링크할 스킬이 셋 이상으로 늘어 하나씩 관리하기 번거로울 때.
