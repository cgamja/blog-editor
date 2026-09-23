# Tasks — sticker-size-fit

스티커가 너무 커서(블록 폭 최대 50%) 화면 가장자리에서 잘린다는 사용자 확인(2026-09-23, 사이트 로컬 빌드). 저장된 글은 아직 없어 마이그레이션이 필요 없다.

## 1. 스키마

- [x] 1.1 `packages/content-schema/src/doc.test.ts` — 끝값 통과 사례의 `size: 50` → `25`, 범위 밖 거부에 `size: 26` 추가 → verify: 빨강(26이 통과) 원문 보고
- [x] 1.2 `doc.ts` `STICKER_RANGES.size.max` 50 → 25, `fixtures.posts.ts`의 25 초과 size를 25 이하로 → verify: `pnpm test` 초록(렌더 스냅샷 · 계약 픽스처는 `-u`로 다시 만들고 diff 검토)

## 2. CSS

- [x] 2.1 `packages/content-render/src/post.css` — `.post-sticker` `left`를 모든 폭에서 스티커 폭만큼 안쪽 clamp, 좁은 화면은 `top`만 clamp → verify: 사이트 로컬 빌드 1280 · 375 스크린샷에서 잘림 없음 · `pnpm verify` 초록
