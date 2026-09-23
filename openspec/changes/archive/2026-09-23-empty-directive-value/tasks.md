# Tasks — empty-directive-value (이슈 #28)

기존 코드: 후보 판정은 `packages/content-convert/src/directives.ts`의 `isDirectiveBody`(`PAIR`), 값 검사는 같은 파일 `validateDirective`(빈 문자열은 이미 키별 값 오류). 버그라 재현 테스트가 먼저이고 `test(convert):` 커밋으로 분리한다.

## 1. 재현 테스트 (빨강)

- [x] 1.1 `convert.test.ts` — 알려진 키 빈 값 it.each 1개 + 알 수 없는 키 빈 값 회귀 1개 → verify: 빨강 원문 보고(빈 값 쪽만 빨강)

## 2. 구현

- [x] 2.1 `directives.ts` — 후보 판정이 알려진 키의 `키=`를 받아들인다 → verify: 1.1 초록 · `pnpm verify` 초록
