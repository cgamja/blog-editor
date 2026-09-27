# AI 연결 — `/mcp`에 Claude · Codex 붙이기

AI(채팅 앱)가 블로그 초안을 쓰게 하는 MCP 커넥터(adr-007 · adr-016). 도구는 6개이고 **초안만** 쓴다 — 발행은 사람이 에디터에서 한다.

## 1. 로컬 서버를 MCP와 같이 띄운다

레포 루트 `.env`(gitignore됨)에 두 줄을 더한다 — 로그인 값(`ADMIN_PASSWORD` 등)과 같은 파일이다:

```bash
# 연결용 토큰 — 이 값이 곧 비밀번호다. 어디에도 커밋하지 않는다
echo "MCP_CONNECTION_TOKEN=$(openssl rand -hex 32)" >> .env
echo "MCP_CONNECTION_TOKEN_NAME=claude-code" >> .env

pnpm --filter @blog-editor/api dev
# → api: http://127.0.0.1:8787 … · mcp: http://127.0.0.1:8787/mcp
```

`MCP_CONNECTION_TOKEN`이 없으면 `/mcp`는 열리지 않는다. 셸에 같은 이름이 있으면 셸 값이 이긴다. 로그인 env는 서버 머리 주석(`apps/editor/api/src/serve.ts`)을 따른다.

## 2-a. Claude Code — 가장 짧은 길 (로컬 그대로)

```bash
claude mcp add --transport http blog-editor http://127.0.0.1:8787/mcp \
  --header "Authorization: Bearer <위에서 만든 토큰>"
```

Claude Code에서 `/mcp`로 `connected`를 확인하고 "블로그 초안 하나 써 줘"라고 하면 된다. Claude는 `get_writing_guide`를 먼저 읽고 `create_draft`를 부르며, 응답의 에디터 링크를 알려 준다. 레포 스킬로 한 번에 쓰려면 `/blog-write <주제>`.

## 2-b. claude.ai 커스텀 커넥터

claude.ai는 Anthropic 클라우드에서 서버로 접속한다 — **서버가 공개 인터넷에서 HTTPS로 닿아야 한다.** 로컬 서버라면 터널(예: Cloudflare Tunnel, ngrok)이 필요하고, M4 배포 뒤에는 `https://editor.simsimeestudio.com/mcp`를 쓰면 된다.

### OAuth로 붙이기 (모든 계정)

전제: 1절의 `MCP_CONNECTION_TOKEN`이 `.env`에 있어야 한다 — OAuth는 `/mcp` 위에 붙는다(없이 `PUBLIC_BASE_URL`만 넣으면 서버가 시작하지 않고 알려 준다).

> **터널로 열면 로그인 화면이 인터넷에 나간다.** `ADMIN_PASSWORD`를 `1234` 같은 짧은 값으로 두지 말고 긴 무작위 값으로 바꾸고(`openssl rand -base64 24`), `ADMIN_USERNAME`도 `admin` 말고 추측하기 어려운 값으로 둔다. 연속 5번 틀리면 그 계정이 15분 잠기지만(재시작하면 풀린다), 잠금은 보조 장치다 — 비밀번호 길이가 방어의 중심이다(D8). 반대로 아이디를 아는 사람은 5번 틀려 그 계정을 15분씩 잠글 수 있다.

1. 터널을 띄우고 그 주소를 레포 루트 `.env`에 넣는다 — 경로 없는 origin만:
   ```bash
   cloudflared tunnel --url http://127.0.0.1:8787   # → https://xxx.trycloudflare.com
   echo "PUBLIC_BASE_URL=https://xxx.trycloudflare.com" >> .env
   pnpm --filter @blog-editor/api dev                 # 로그에 oauth: https://xxx… 가 찍힌다
   ```
   이 값이 `.env`에 있는 동안은 세션 쿠키가 배포와 같은 Secure라 로컬 에디터에 Safari로 로그인할 수 없다(Chrome은 된다, adr-026). 값을 빼고 다시 켜면 돌아온다.
2. **Customize › Connectors › Add custom connector** → URL `https://xxx.trycloudflare.com/mcp`, 인증 칸(OAuth Client ID/Secret)은 **비운다** — claude.ai가 스스로 등록한다(DCR)
3. 연결하면 로그인 · 동의 화면이 뜬다 → 에디터 아이디 · 비밀번호(`.env`의 `ADMIN_USERNAME` · `ADMIN_PASSWORD`) → **허용**
4. 채팅의 **+ › Connectors**에서 켠다. 초안 출처는 `token:oauth-claude-ai`로 적힌다

OAuth 상태(등록 · 토큰)는 메모리에 있다 — 서버를 다시 켜면 claude.ai에서 다시 연결한다. 터널 주소가 바뀌면 `PUBLIC_BASE_URL`도 바꾼다.

### Request headers로 붙이기 (베타 — 일부 계정만)

1. **Customize › Connectors › Add custom connector**
2. URL: `https://<공개 주소>/mcp`
3. Authentication: **No sign-in** → **Request headers**에 `authorization` = `Bearer <토큰>`(앞의 `Bearer `까지 입력)
4. 채팅의 **+ › Connectors**에서 켠다

## 2-c. Codex CLI (로컬 그대로)

Codex도 같은 `/mcp`에 붙는다. 도구 6개와 "초안만" 규칙은 Claude Code와 같다. 설정 파일에는 토큰 값을 적지 않고 **환경 변수 이름만** 적는다(`bearer_token_env_var`, https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

```bash
codex mcp add blog-editor --url http://127.0.0.1:8787/mcp --bearer-token-env-var BLOG_EDITOR_MCP_TOKEN
codex mcp list   # blog-editor가 보이면 된다
```

**토큰 넣기.** 값은 1절의 `MCP_CONNECTION_TOKEN`과 같다. 셸 설정 파일(`~/.zshrc`)에 평문으로 적지 않는다. 그 파일은 백업 · dotfiles 저장소로 퍼지기 쉽다. 두 가지 방법이 있다.

- macOS 키체인에 한 번 넣어 두고, Codex를 켤 때만 꺼내 쓴다:
  ```bash
  security add-generic-password -a "$USER" -s blog-editor-mcp -w   # 토큰을 묻는다(한 번)
  BLOG_EDITOR_MCP_TOKEN="$(security find-generic-password -a "$USER" -s blog-editor-mcp -w)" codex
  ```
- 그 셸에서만 쓴다. 값을 입력 프롬프트로 받아 셸 기록(`~/.zsh_history`)에 남지 않게 한다. 창을 닫으면 사라지므로 매번 넣어야 한다:
  ```bash
  read -rs BLOG_EDITOR_MCP_TOKEN && export BLOG_EDITOR_MCP_TOKEN   # 토큰을 붙여 넣고 Enter(화면에 안 보인다)
  ```

어느 쪽이든 명령줄에 토큰 값을 직접 쓰지 않는다.

로컬 루프백 서버라 `~/.zshrc`에 두는 편리함을 고를 수도 있다. 그 경우에는 그 파일이 어디로 복사 · 동기화되는지 알고 고른다.

**도구 허락 — 쓰기만 묻기.** 대화형 Codex는 도구를 부를 때 허락을 묻는다. 서버가 읽기 도구 4개(`get_writing_guide` · `list_posts` · `get_post` · `check_draft`)에 `readOnlyHint: true`를 달아 두었으므로(#159), `default_tools_approval_mode = "writes"` 한 줄이면 읽기는 묻지 않고 쓰기 도구 2개(`create_draft` · `update_draft`)만 묻는다("The `writes` mode prompts for tools that aren't marked read-only", https://learn.chatgpt.com/docs/extend/mcp?surface=cli · 키는 https://learn.chatgpt.com/docs/config-file/config-reference). `~/.codex/config.toml`:

```toml
[mcp_servers.blog-editor]
url = "http://127.0.0.1:8787/mcp"
bearer_token_env_var = "BLOG_EDITOR_MCP_TOKEN"
# 읽기 4개는 묻지 않고, 초안을 만들거나 고치는 2개만 묻는다
default_tools_approval_mode = "writes"
```

대안 — 도구별 설정. `create_draft`까지 묻지 않게 하려면(새 초안만 만들고, 이미 있는 주소면 거부되어 남의 글을 덮지 못한다) 그 도구만 덮어쓴다. `update_draft`는 사람이 에디터에서 쓰는 중인 글을 바꿀 수 있어 늘 묻게 둔다:

```toml
[mcp_servers.blog-editor.tools.create_draft]
approval_mode = "approve"
```

서버 전체를 자동 허락하는 `default_tools_approval_mode = "approve"`는 권하지 않는다. 사용자 설정에 넣으면 모든 Codex 세션이 묻지 않고 `update_draft`로 초안을 바꿀 수 있다. 스킬은 웹 문서를 읽으므로, 웹 문서에 숨은 지시(프롬프트 인젝션)가 그 길로 초안을 고칠 위험도 생긴다.

**비대화형 `codex exec`.** 이 모드는 허락을 물을 수 없다. 그래서 묻게 둔 도구는 `MCP tool call requires approval, but approval policy is never`로 실패한다(2026-09-25 도구별 설정으로 실제로 확인). `writes`만 두면 읽기는 되고 `create_draft` · `update_draft`가 실패한다 — 위 대안처럼 `create_draft`를 허락해 두면 `update_draft`만 실패한다. 그 한 번의 실행에서 저장 · 고치기까지 맡길 때만 그 실행에 `-c`로 허락을 준다:

```bash
codex exec \
  -c 'mcp_servers.blog-editor.tools.create_draft.approval_mode="approve"' \
  -c 'mcp_servers.blog-editor.tools.update_draft.approval_mode="approve"' \
  '$blog-write <주제>'
```

**웹 검색.** Codex 기본 웹 검색(`web_search = "cached"`)은 OpenAI가 관리하는 색인만 보고 원문 페이지에 가지 않는다(같은 config-reference). `/blog-write`는 숫자 · 사실을 원문에서 확인하므로 실시간 검색을 켠다: 대화형은 `codex --search`, `codex exec`는 `-c 'web_search="live"'`, 늘 쓰려면 `web_search = "live"`. 켜지 않으면 스킬은 원문을 확인하지 못한 사실을 쓰지 않고 그렇다고 알린다.

레포 스킬은 Codex에서 `$blog-write <주제>`로 부른다. "블로그 초안 써 줘"처럼 말해도 설명을 보고 고른다. Codex는 레포의 `.agents/skills/`를 읽고, 그 안의 `blog-write`는 `.claude/skills/blog-write`를 가리키는 링크다. 그래서 원본은 하나다(adr-035, https://learn.chatgpt.com/docs/build-skills). Claude Code에는 저장 직후 SEO 훅이 생길 예정이다(#149). Codex에는 그런 장치가 없으므로, 저장 응답의 seo 결과를 스킬 규칙이 확인한다.

## 도구

| 도구                | 하는 일                                                 |
| ------------------- | ------------------------------------------------------- |
| `get_writing_guide` | 형식 가이드(블록 · 콜아웃 · 꾸미기 지시어 · 이미지)     |
| `list_posts`        | 글 목록 요약                                            |
| `get_post`          | 글 하나를 markdown + revision으로                       |
| `check_draft`       | 저장하지 않고 형식만 검사                               |
| `create_draft`      | 새 초안 저장(항상 초안, 출처 `token:<이름>`)            |
| `update_draft`      | revision이 맞을 때만 초안을 고침. 발행된 글은 못 고친다 |
