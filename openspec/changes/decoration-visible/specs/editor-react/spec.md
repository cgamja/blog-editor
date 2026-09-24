## ADDED Requirements

### Requirement: 편집 중에는 움직임을 재생하지 않는다

`@blog-editor/editor-react/editor.css`는 SHALL 편집 영역(`.blog-editor .ProseMirror`) 안의 `[data-motion]` 요소에 `animation-name: none`을 준다. 본문 CSS(post.css)의 움직임 규칙보다 명시도가 높아 불러오는 순서와 무관하다. 미리보기 · 공개 HTML의 움직임은 그대로다.

#### Scenario: 편집 영역의 움직임 규칙이 본문 CSS를 이긴다

- **WHEN** editor.css의 규칙 중 선택자에 `[data-motion]`이 있는 것을 찾는다
- **THEN** `.blog-editor .ProseMirror [data-motion]` 규칙이 있고 `animation-name: none`을 선언한다
