---
paths: ["apps/editor/web/**/*.tsx", "apps/editor/editor-react/**/*.tsx", "**/*.css"]
---

# 플랫폼 프로필: web-desktop

백오피스 에디터 — 글쓰기는 데스크톱 브라우저(macOS Chrome/Safari · Windows Chrome, plan 05 수동 표). UI task의 증거와 리뷰 2축이 이 파일을 읽는다. 각 항목 끝 대괄호는 강제 수단(플러그인 adr/0031).

- 뷰포트 스크린샷: 1280 기본 · 768 · 375에서 깨지지 않음 **[없음 — evidence.screenshot 미선언, web 생기면 촬영 스크립트를 선언한다]**
- 다크 모드: 없음 — 디자인 캔버스가 라이트만 정했다. 다크 증거는 찍지 않고 만들지도 않는다 **[evidence.dark]**
- 입력 기본: 포인터 + 키보드. 에디터 단축키는 macOS ⌘ / Windows Ctrl 둘 다 **[사람 — 리뷰 2축]**
- 터치 타깃 24px(WCAG 2.2) **[사람 — 리뷰 2축]**
- 성능: 꾸미기를 최대로 쓴 픽스처 글의 Lighthouse 기준선(plan 05 · D14) **[없음 — commands.perf 미선언]**
- 금지: 고정 `px` 폭, `100vh`(→ `dvh`), 토큰 외 색 · 간격, 임의값. 값의 원천은 `design/tokens.json`(캔버스에서 뽑음) **[없음 — design.tokens 미선언, web 생기면 토큰 파일 + 린트]**
- 뷰포트 · 상태는 `design/map.md`의 아트보드를 따르고, 디자인에 없는 상태(빈 목록 · 저장 중 · 401 · 로그인)는 구현이 채운다 **[사람 — 리뷰 2축]**
- 텍스트 `rem`, 200% 확대에서 잘림 0 **[evidence.zoom200]**
