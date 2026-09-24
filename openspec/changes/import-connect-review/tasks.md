# Tasks — import-connect-review (PR #105 리뷰)

## 1. 테스트

- [ ] 1.1 api `import-preview.test.ts` · `settings.test.ts`, web `http.test.ts` · `import-draft.test.ts`에 시나리오 추가 → verify: 빨강 · 실패 원문 보고

## 2. 구현

- [ ] 2.1 리뷰 지적 수정 한 번(`fix(review)`) → verify: 1.1 초록 · 실브라우저 다시

## 3. Converge

- [ ] 3.1 `pnpm verify` 초록 · `openspec validate --all --strict`
