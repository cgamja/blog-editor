## MODIFIED Requirements

### Requirement: 정의 밖 markdown은 거부한다

변환은 SHALL 다음을 변환하지 않고 거부한다.

- `#` h1 · h4 이하 · 표 · 각주 · 할 일 목록
- 쓰이지 않는 링크 참조 정의(`[r]: url`)
- 인라인/블록 HTML(`<div>` · `<br>` · `<u>` 포함)
- 절대 URL 이미지
- 인용 안의 제목 · 목록 안의 코드 블록
- 문단 하나 + 안쪽 목록 모양이 아닌 목록 항목(문단 둘 · 안쪽 목록 뒤 문단 · 문단 없이 시작)

쓰인 참조 링크(`[글][r]` + `[r]: url`)는 인라인 링크와 같은 doc가 되므로 받는다. 링크 문법이 보이면(참조 링크 포함) 파서 필터와 무관하게 href를 `hrefSchema`로 검사해 거부한다. `javascript:` 링크를 글자로 조용히 남기지 않기 위해서다. 받은 글자 · 링크가 결과에서 조용히 사라지면 안 된다. 그래서 결과 doc에 자리가 없는 입력은 성공으로 돌려주지 않고 거부한다.

#### Scenario: 정의 밖 markdown은 거부한다

- **WHEN** 다음 열세 가지를 각각 넣는다
  - `# 제목` · 표(`| a | b |` 다음 줄 `|---|---|`) · `<u>밑줄</u>` · `<div>` · `<br>`
  - `![x](https://a.com/x.png)` · `[x](javascript:alert(1))`
  - 인용 안의 `## 제목` · 목록 항목 안의 ``` 펜스
  - 각주(`글[^1]` · 빈 줄 · `[^1]: 설명`) · 할 일 목록(`- [ ] 할 일`)
  - 쓰이지 않는 링크 참조 정의(`글` · 빈 줄 · `[r]: https://a.com`)
  - 목록 항목 안 두 번째 문단(`- a` · 빈 줄 · `  b`)
- **THEN** 열세 경우 모두 변환이 실패하고 markdown-validation-message 형식의 메시지가 나온다

## ADDED Requirements

### Requirement: 취소선과 괄호 span은 마크가 된다

변환은 SHALL 두 문법을 마크로 바꾼다(ADR-020).

- `~~글자~~` → `strike`
- 괄호 span `[글자]{키=값 …}` → `textStyle`(키 `font` · `weight` · `size` · `color` · `highlight`)과 `underline`(값 없는 키 `underline`)
  - 값은 decoration-schema 집합이다. hex는 대소문자를 받아 소문자로 저장한다
  - 정의 밖 키 · 값, 같은 키 두 번, 글꼴에 없는 두께는 줄 번호가 붙은 실패 메시지가 된다
  - `{…}`가 `키=값`/`underline` 모양이 아니면 span이 아니다. 그 경우 글자 그대로 남는다
  - span 안에는 다른 마크(굵게 · 링크 등)가 올 수 있고, 링크 글자 안의 span도 같은 결과다(링크가 사라지지 않는다)

#### Scenario: span과 취소선이 마크가 된다

- **WHEN** `[강조]{color=brand size=lg underline} 그리고 ~~취소~~ [**굵게**]{highlight=#FFF1CC}`를 변환한다
- **THEN** 결과는 다음과 같다
  - "강조": textStyle `{ color: "brand", size: "lg" }` + `underline`
  - "취소": `strike`
  - "굵게": textStyle `{ highlight: "#fff1cc" }` + `bold`

#### Scenario: span 값 오류는 거부한다

- **WHEN** `[가]{color=pink}` · `[가]{colour=brand}` · `[가]{font=jua weight=light}` · `[가]{size=lg size=xl}`를 각각 변환한다
- **THEN** 넷 모두 실패하고 메시지가 줄 번호와 받은 값을 담는다
