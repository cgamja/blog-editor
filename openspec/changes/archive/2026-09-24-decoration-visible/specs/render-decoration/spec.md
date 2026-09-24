## ADDED Requirements

### Requirement: 스티커 원본 파일은 크기 상수와 같다

`packages/content-render/assets/stickers/`는 SHALL `STICKER_IDS`마다 `{id}.png` 한 장을 두고, 그 PNG의 픽셀 크기는 `STICKER_SIZES[id]`와 같다. 공개 URL `{imageBaseUrl}/stickers/{id}.png`의 원본 폴더다.

#### Scenario: 아홉 장 모두 있고 크기가 상수와 같다

- **WHEN** `STICKER_IDS`의 각 id로 `assets/stickers/{id}.png`의 PNG 헤더(IHDR)를 읽는다
- **THEN** 아홉 장 모두 있고 너비 · 높이가 `STICKER_SIZES[id]`와 같다
