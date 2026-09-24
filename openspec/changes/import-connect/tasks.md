# Tasks — import-connect (이슈 #98)

## 1. 테스트

- [ ] 1.1 api `settings.test.ts` · `file-settings-store.test.ts` · `import-preview.test.ts` · `mcp.test.ts`(추가) · `openapi.test.ts`(추가), web `import-draft.test.ts` · `ai-write.test.ts` · `connector.test.ts` → verify: 빨강 · 실패 원문 보고

## 2. 구현

- [ ] 2.1 계약 표 · `api/openapi.json` → verify: 계약 테스트
- [ ] 2.2 설정 저장소 · 라우트 · MCP 가이드 · 가져오기 미리보기 → verify: 1.1 api 초록
- [ ] 2.3 web 순수 함수 · 대화상자 · `/connect` → verify: 1.1 web 초록 · typecheck · lint
- [ ] 2.4 실브라우저: 가져오기(성공 · 막힘) · `/connect` 가이드 저장 · AI로 쓰기 → verify: 스크린샷 · 콘솔 오류 0

## 3. Converge

- [ ] 3.1 시나리오 ↔ 테스트 · 증거 대조 → verify: `pnpm verify` 초록 · `openspec validate --all --strict`
