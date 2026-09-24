## ADDED Requirements

### Requirement: 글자 스타일 · 정렬 어휘마다 규칙이 있다

`post.css`는 SHALL 다음 값마다 규칙을 둔다(ADR-020).

- `.post-ts`의 `[data-font]` 3종 · `[data-weight]` 3종(300 · 500 · 800) · `[data-size]` 4종(0.875 · 1.25 · 1.5 · 2em)
- `[data-color]` 프리셋 4종 + `custom`(`var(--ts-color)`)
- `[data-highlight]` 프리셋 3종 + `custom`(`var(--ts-highlight)`)
- 래퍼 `[data-align]` 3종: 글 블록은 `text-align`, 그림 블록은 좌우 여백

프리셋 색은 사이트 토큰 변수(`--ink-soft` · `--brand-ink` · `--accent-ink` · `--danger-ink` · `--brand-soft` · `--accent-soft` · `--postit`)를 이어받는다.

#### Scenario: 새 enum 값마다 선택자가 있다

- **WHEN** 텍스트 스타일 · 정렬 상수(`@blog-editor/content-schema`)의 각 값으로 `[data-weight="…"]` · `[data-size="…"]` · `[data-color="…"]` · `[data-highlight="…"]` · `[data-align="…"]` 문자열을 만든다
- **THEN** 전부 `post.css`에 들어 있다
