# AI 연결 — `/mcp`에 Claude 붙이기

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

Claude Code에서 `/mcp`로 `connected`를 확인하고 "블로그 초안 하나 써 줘"라고 하면 된다. Claude는 `get_writing_guide`를 먼저 읽고 `create_draft`를 부르며, 응답의 에디터 링크를 알려 준다.

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
2. **Customize › Connectors › Add custom connector** → URL `https://xxx.trycloudflare.com/mcp`, 인증 칸(OAuth Client ID/Secret)은 **비운다** — claude.ai가 스스로 등록한다(DCR)
3. 연결하면 로그인 · 동의 화면이 뜬다 → 에디터 아이디 · 비밀번호(`.env`의 `ADMIN_USERNAME` · `ADMIN_PASSWORD`) → **허용**
4. 채팅의 **+ › Connectors**에서 켠다. 초안 출처는 `token:oauth-claude-ai`로 적힌다

OAuth 상태(등록 · 토큰)는 메모리에 있다 — 서버를 다시 켜면 claude.ai에서 다시 연결한다. 터널 주소가 바뀌면 `PUBLIC_BASE_URL`도 바꾼다.

### Request headers로 붙이기 (베타 — 일부 계정만)

1. **Customize › Connectors › Add custom connector**
2. URL: `https://<공개 주소>/mcp`
3. Authentication: **No sign-in** → **Request headers**에 `authorization` = `Bearer <토큰>`(앞의 `Bearer `까지 입력)
4. 채팅의 **+ › Connectors**에서 켠다

## 도구

| 도구                | 하는 일                                                 |
| ------------------- | ------------------------------------------------------- |
| `get_writing_guide` | 형식 가이드(블록 · 콜아웃 · 꾸미기 지시어 · 이미지)     |
| `list_posts`        | 글 목록 요약                                            |
| `get_post`          | 글 하나를 markdown + revision으로                       |
| `check_draft`       | 저장하지 않고 형식만 검사                               |
| `create_draft`      | 새 초안 저장(항상 초안, 출처 `token:<이름>`)            |
| `update_draft`      | revision이 맞을 때만 초안을 고침. 발행된 글은 못 고친다 |
