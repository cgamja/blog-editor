---
paths: ["apps/editor/editor-core/**", "apps/editor/editor-react/**", "packages/content-schema/**"]
---

# 에디터 · 문서 모델

- 커맨드 · 플러그인은 ProseMirror 순수 함수 `(state, dispatch) => boolean`으로 editor-core에. TipTap 확장은 등록만(adr-002). React · TipTap · ProseMirror가 허용 패키지 밖으로 못 나간다 **[commands.lint]**
- ProseMirror/TipTap API는 기억으로 쓰지 않는다 — 공식 문서 링크를 근거로 단다 **[사람 — 리뷰 2축]**
- `view.composing` 동안 문서를 바꾸는 부수 효과를 미룬다. 선택 영역 · IME · NodeView 생명주기 변경은 실브라우저에서 확인하고 PR "확인 방법"에 적는다 **[tests.layers.browser(Chromium) — IME · Safari는 수동 체크리스트]**
- 문서에 들어갈 수 있는 것은 zod가 정의한다(닫힌 집합). 임의 CSS · 클래스 · 페이지 좌표 · 절대 URL 이미지는 자리가 없다 **[tests.layers.unit]**
- 정규형 하나(마크 순서 · 인접 텍스트 병합 · 키 순서). 정규화는 멱등 — 속성 기반 테스트 대상 **[tests.layers.unit]**
