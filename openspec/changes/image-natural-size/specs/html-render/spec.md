## ADDED Requirements

### Requirement: 크기가 있는 이미지는 img에 width · height를 낸다

렌더러는 SHALL `image` · `appScreenshot`에 `naturalWidth` · `naturalHeight`가 있으면 `<img>`의 `alt` 뒤에 `width="<naturalWidth>" height="<naturalHeight>"`를 낸다(없으면 지금처럼 생략). 본문용 CSS는 이미지를 `width: 100%; height: auto`로 그리므로 이 속성은 크기를 고정하지 않고 비율 자리만 먼저 잡는다(레이아웃 밀림 방지). 꾸미기 `width`(%)의 `--w`와 공존한다.

#### Scenario: 원본 크기가 img 속성으로 나간다

- **WHEN** `src: "/images/a.webp"` · `alt: "그림"` · `naturalWidth: 1200` · `naturalHeight: 800` · `width: 60`인 이미지를 `imageBaseUrl: "https://cdn.example.com"`으로 렌더한다
- **THEN** `<img src="https://cdn.example.com/images/a.webp" alt="그림" width="1200" height="800" loading="lazy" decoding="async">`가 나오고 figure에 `--w:60`이 있다
