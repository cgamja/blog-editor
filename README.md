# blog-editor

심심이스튜디오 블로그용 웹 에디터(백오피스). 글을 문서 JSON으로 저장하고, 공개 사이트는 빌드할 때 이 서비스의 API에서 렌더된 HTML을 받아 간다. Claude · ChatGPT는 MCP 커넥터로 연결해 초안을 쓴다 — 발행은 사람만 한다.

- 에디터: `editor.simsimeestudio.com` (예정)
- 사이트: https://simsimeestudio.com/blog
- 설계 결론: https://claude.ai/artifact/GXURYB4TghmCGNX5bLWQr4 · PRD: https://claude.ai/artifact/Rm3nPgTioyyenou6MTjoNW

## 시작

```bash
pnpm install
pnpm verify
```

## 구조와 규칙

`CLAUDE.md`(구조 · 규칙 · 규약)와 `adr/`(결정 기록)를 본다. 진행 상황은 GitHub 마일스톤 M0~M6.
