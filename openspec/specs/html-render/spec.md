# html-render Specification

## Purpose

검증된 `PostFile`의 `doc`를 HTML 문자열로 바꾸는 순수 함수. 에디터 미리보기와 공개 API(`GET /public/posts`)가 같은 함수를 쓴다(adr-001). 출력은 태그 · 클래스 · `data-*` · CSS 변수만으로 된 닫힌 어휘이고 모양은 `render-css`가 입힌다(adr-008).

## Requirements

### Requirement: renderHtml은 doc를 결정적인 HTML 문자열로 바꾼다

`@blog-editor/content-render`는 SHALL `renderHtml(file, { imageBaseUrl })`를 export한다. `file`은 `doc`를 가진 객체(`PostFile` 그대로 넘겨도 된다 — `meta`는 읽지 않는다), 반환은 `<div class="post-body">…</div>` 하나로 감싼 HTML 문자열이다. 같은 입력에 같은 출력(순수 함수 · 입력 불변 · 공백 · 속성 순서 고정), 줄바꿈 · 들여쓰기는 넣지 않는다.

블록 대응: `paragraph`→`<p>` · `heading`→`<h2>`/`<h3>` · `bulletList`→`<ul>` · `orderedList`→`<ol>` · `listItem`→`<li>`(안의 `paragraph`는 `<p>`, 이어지는 안쪽 리스트는 `<li>` 안에) · `blockquote`→`<blockquote>` · `codeBlock`→`<pre><code data-language="…">`(`language` 없으면 속성 생략) · `horizontalRule`→`<hr>` · `image`→`<figure class="post-image"><img src alt loading="lazy" decoding="async"></figure>` · `callout`→`<aside class="post-callout" data-tone="…">` · `appScreenshot`→`<figure class="post-screenshot"><img src alt="" loading="lazy" decoding="async"><figcaption>…</figcaption></figure>`. 빈 `content`는 빈 요소(`<p></p>`).

마크 대응: `link`→`<a href>` · `bold`→`<strong>` · `italic`→`<em>` · `code`→`<code>`. 여러 마크가 겹치면 바깥부터 `a > strong > em > code` 순으로 고정한다(입력의 마크 순서와 무관).

#### Scenario: 대표 픽스처 3개의 출력이 스냅샷과 같다

- **WHEN** `fixtures.minimal` · `fixtures.allBlocks` · `fixtures.decorationMax`(`@blog-editor/content-schema`)를 `imageBaseUrl: "https://cdn.example.com"`으로 렌더한다
- **THEN** 각 출력이 저장된 스냅샷과 문자 단위로 같고, 입력 객체는 렌더 전과 deep-equal이다

#### Scenario: 겹친 마크는 고정 순서로 중첩된다

- **WHEN** 한 텍스트에 `marks: [{ type: "code" }, { type: "bold" }, { type: "link", attrs: { href: "/a" } }, { type: "italic" }]`를 준다
- **THEN** 출력에 `<a href="/a"><strong><em><code>…</code></em></strong></a>`가 그대로 들어 있다

### Requirement: 이미지 경로는 imageBaseUrl 뒤에 붙는다

렌더러는 SHALL `image` · `appScreenshot`의 `src`(스키마상 `/images/…` 경로)를 `imageBaseUrl + src`로 만든다. `imageBaseUrl` 끝의 `/` 하나는 떼어 `//`가 생기지 않게 한다. 문서에는 도메인이 없으므로(adr-003 · plan 3-8) 도메인을 바꿔도 글은 그대로다.

#### Scenario: 끝 슬래시가 있어도 경로가 한 번만 이어진다

- **WHEN** `src: "/images/a.webp"`인 이미지를 `imageBaseUrl: "https://cdn.example.com/"`로 렌더한다
- **THEN** `src="https://cdn.example.com/images/a.webp"`이고 `//images`는 없다

### Requirement: 텍스트와 속성값은 항상 이스케이프된다

렌더러는 SHALL 텍스트 노드 · `alt` · `caption` · `href` · `language` 등 문서에서 온 모든 문자열의 `&` `<` `>` `"` `'`를 엔티티로 바꾼다. 문서 문자열이 태그나 속성 경계를 만들 길은 없다.

#### Scenario: 마크업처럼 생긴 텍스트는 글자로 나온다

- **WHEN** 문단 텍스트가 `<b onclick="x">&"'`이고 이미지 `alt`가 `"><img src=x onerror=1>`인 문서를 렌더한다
- **THEN** 출력에 `&lt;b onclick=&quot;x&quot;&gt;&amp;&quot;&#39;`가 있고 `alt="&quot;&gt;&lt;img src=x onerror=1&gt;"`이며, 새 태그는 생기지 않는다

실패 의미론: 해당 없음 — 순수 함수.

### Requirement: 크기가 있는 이미지는 img에 width · height를 낸다

렌더러는 SHALL `image` · `appScreenshot`에 `naturalWidth` · `naturalHeight`가 있으면 `<img>`의 `alt` 뒤에 `width="<naturalWidth>" height="<naturalHeight>"`를 낸다(없으면 지금처럼 생략). 본문용 CSS는 이미지를 `width: 100%; height: auto`로 그리므로 이 속성은 크기를 고정하지 않고 비율 자리만 먼저 잡는다(레이아웃 밀림 방지). 꾸미기 `width`(%)의 `--w`와 공존한다.

#### Scenario: 원본 크기가 img 속성으로 나간다

- **WHEN** `src: "/images/a.webp"` · `alt: "그림"` · `naturalWidth: 1200` · `naturalHeight: 800` · `width: 60`인 이미지를 `imageBaseUrl: "https://cdn.example.com"`으로 렌더한다
- **THEN** `<img src="https://cdn.example.com/images/a.webp" alt="그림" width="1200" height="800" loading="lazy" decoding="async">`가 나오고 figure에 `--w:60`이 있다

### Requirement: 표는 머리 행과 본문으로 나눈 table로 낸다

`renderHtml`은 SHALL `table`을 `<div class="post-table-scroll"><table><thead><tr>…</tr></thead><tbody>…</tbody></table></div>`로 낸다(adr-028). 첫 행은 `<thead>` 안 `<th scope="col">`, 나머지 행은 `<tbody>` 안 `<td>`다. 본문 행이 없으면 `<tbody>`를 내지 않는다. 열 정렬은 그 열의 모든 칸에 `data-align="center|right"`로 낸다(`style`은 쓰지 않는다). 칸 안 문단은 `<p>` 없이 인라인만 낸다. 표 꾸미기는 다른 블록처럼 `div.post-block`으로 감싼다.

#### Scenario: 정렬 열이 있는 표

- **WHEN** 머리 행 `이름` · `값`(`align: "right"`), 본문 행 `가` · `1`인 표를 렌더한다
- **THEN** 출력이 `<div class="post-table-scroll"><table><thead><tr><th scope="col">이름</th><th scope="col" data-align="right">값</th></tr></thead><tbody><tr><td>가</td><td data-align="right">1</td></tr></tbody></table></div>`다

### Requirement: 강제 줄바꿈은 br로 낸다

렌더러는 SHALL `hardBreak`를 속성 없는 `<br>`로 낸다. 문단 안 다른 인라인과 같은 자리에 둔다.

#### Scenario: 문단 안 br

- **WHEN** 문단 `가` · `hardBreak` · `나`(bold)를 렌더한다
- **THEN** `<p>가<br><strong>나</strong></p>`가 나온다
