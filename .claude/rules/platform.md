---
paths: ["apps/editor/web/**/*.tsx", "apps/editor/editor-react/**/*.tsx", "**/*.css"]
---

# 플랫폼 프로필: web-desktop

백오피스 에디터 — 글쓰기는 데스크톱 브라우저(macOS Chrome/Safari · Windows Chrome, plan 05 수동 표). UI task의 증거와 리뷰 2축이 이 파일을 읽는다. 각 항목 끝 대괄호는 강제 수단(플러그인 adr/0031).

- 뷰포트 스크린샷: 1280 기본 · 768 · 375에서 깨지지 않음 **[없음 — evidence.screenshot 미선언, web 생기면 촬영 스크립트를 선언한다]**
- 다크 모드: 사이트와 같은 `data-theme="dark"` 토글(시스템 설정 안 따름). 뷰포트마다 2배 **[evidence.dark]**
- 입력 기본: 포인터 + 키보드. 에디터 단축키는 macOS ⌘ / Windows Ctrl 둘 다 **[사람 — 리뷰 2축]**
- 터치 타깃 24px(WCAG 2.2) **[사람 — 리뷰 2축]**
- 성능: 꾸미기를 최대로 쓴 픽스처 글의 Lighthouse 기준선(plan 05 · D14) **[없음 — commands.perf 미선언]**
- 금지: 고정 `px` 폭, `100vh`(→ `dvh`), 토큰 외 색 · 간격, 임의값 **[없음 — design.tokens 미선언]**
- 텍스트 `rem`, 200% 확대에서 잘림 0 **[evidence.zoom200]**
