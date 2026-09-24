# Tasks — block-align-review

## 1. 테스트

- [x] 1.1 normalize(기본 정렬 지움 · defaultAlignOf) · convert(가져오기) · serialize(직렬화) · 패널(섞인 선택) → verify: 빨강 · 실패 원문 보고

## 2. 구현

- [x] 2.1 content-schema `defaultAlignOf` · normalize ⑤ → verify: 1.1 content 초록
- [x] 2.2 editor-core가 `defaultAlignOf` 사용, 패널 섞인 선택 null, `alignName` → verify: 1.1 초록

## 3. Converge

- [x] 3.1 실브라우저: 문단 + 그림 함께 선택 시 정렬 버튼 눌림 없음, 콘솔 0 → verify: `pnpm verify` 초록
