# decoration-visible (이슈 #58)

## Why

꾸미기 UI(M6를 당겨 옴)의 바탕. 지금 에디터 안에서는 글꼴 · 움직임 · 폭은 래퍼로 나가지만 **스티커가 보이지 않는다**(저장 형식에만 있다). plan 3-13 "스티커 · 크기 조절은 편집 화면에서 그대로 보인다". 뒤따를 스티커 끌기(#61) · 꾸미기 패널(#60)은 화면에 보이는 스티커 위에 선다.

## What Changes

- editor-core `withDecoration`: 스티커가 있는 블록도 `div.post-block`으로 감싸고, 블록 요소 뒤(같은 래퍼 안)에 스티커마다 `img.post-sticker`를 낸다 — content-render와 같은 어휘. 편집용으로 `contenteditable="false"` · `draggable="false"`를 더한다
- 스티커 원본 PNG 9종을 `packages/content-render/assets/stickers/`에 둔다(사이트 `public/stickers/`의 사본 — 코드 의존 아님). 공개 URL `{imageBaseUrl}/stickers/{id}.png`의 원본 폴더다
- editor-react `editor.css`: 편집 중에는 움직임(스크롤 애니메이션)을 재생하지 않는다
- 플레이그라운드: 스티커 폴더를 `/stickers/`로 서빙, 한글 글꼴(Jua · Gaegu) 링크

## Impact

- 새 의존성 없음. 보호 파일 변경 없음
- 하지 않는 것: 스티커 고르기 · 끌기(#61), 꾸미기 패널(#60), WebP 변환 · 20KB 게이트(Lighthouse CI 이슈), 배포 서빙(M4 infra)
