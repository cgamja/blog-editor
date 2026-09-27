## MODIFIED Requirements

### Requirement: `serializeMarkdown`은 markdown과 빠진 것 목록을 돌려주는 순수 함수다

`@blog-editor/content-convert`는 SHALL `serializeMarkdown(doc: Doc)`을 export하고 `{ markdown, losses }`를 돌려준다. `markdown`은 markdown-format · markdown-callout · markdown-directive의 입력 문법만 쓰고, 블록이 하나 이상 남으면 `convertMarkdown`이 항상 성공한다(모든 블록이 빠지면 빈 문자열). 블록 사이는 빈 줄 하나, 끝은 줄바꿈 하나다. 콜아웃은 `tone`을 늘 적고, 꾸미기 값은 지시어 줄(`frame` · `font` · `motion` · `align` · `width` · `size` 순, 이어 스티커마다 `sticker=<종류>@<x>,<y>,<크기>,<회전>`을 블록 안 순서대로)로 쓴다(adr-032). markdown으로 나를 수 없는 것은 조용히 버리지 않고 `losses`에 최상위 블록 번호(1부터, 원래 doc 기준)와 함께 적는다 — `{ block, kind: "stickers", count }`(블록째 빠지는 블록 — 빈 문단 등 — 에 붙은 스티커 개수. 쓰이는 블록의 스티커는 지시어로 나르므로 빠지지 않는다) · `{ block, kind: "emptyParagraph", count }`(빈 문단 개수 — 그 문단이 빠지고, 그래서 비는 인용 · 콜아웃도 빠진다. 목록 항목의 첫 문단이 비면 그 항목은 빠지되 안쪽 목록은 버리지 않고 한 단계 위로 올린다 — 원래 목록은 그 자리에서 나뉘고, 올라간 목록이 그 사이에 이웃 목록으로 남는다) · `{ block, kind: "codeMark", count }`(줄 첫 링크 안 코드 마크 글자의 `]:`가 참조 정의로 읽히는 경우 — 그 텍스트의 코드 마크를 빼고 글자로 쓴 수). 순서는 블록 번호순, 같은 블록이면 `stickers` · `emptyParagraph` · `codeMark` 순이다. 같은 입력은 같은 결과이고 입력을 바꾸지 않는다.

#### Scenario: 블록마다 입력 문법 그대로 쓴다

- **WHEN** 제목(level 2 · font jua · motion fade-up · "시작") · 문단("굵게" bold · " 그리고 " · "링크" link `/blog/`) · 콜아웃(tone tip · 문단 "팁" · 글머리 목록 "하나") · 이미지(`/images/a.webp` · alt "그림" · width 60) · 앱 스크린샷(`/images/b.webp` · caption "화면") · 코드 블록(language ts · "let a = 1") · 구분선(motion pop) · 순서 목록(항목 "첫째" 안에 글머리 목록 "안")을 직렬화한다
- **THEN** 블록이 차례로 `{font=jua motion=fade-up}`+`## 시작` · `**굵게** 그리고 [링크](/blog/)` · `:::callout tone=tip`+`팁`+빈 줄+`- 하나`+`:::` · `{width=60}`+`![그림](/images/a.webp)` · `{frame=app}`+`![화면](/images/b.webp)` · 펜스 ` ```ts `+`let a = 1`+` ``` ` · `{motion=pop}`+`---` · `1. 첫째`+`   - 안` 줄들로 나오고(블록 사이 빈 줄 하나, 끝 줄바꿈 하나) `losses`는 `[]`다

#### Scenario: 이웃한 같은 종류 목록은 표지를 바꿔 따로 남긴다

- **WHEN** 글머리 목록 두 개("가" · "나")를 이웃해 직렬화한 뒤 다시 변환한다
- **THEN** `markdown`이 `- 가\n\n* 나\n`이고 변환 결과도 `bulletList` 두 개다

### Requirement: 표는 GFM 표로 쓴다

직렬화는 SHALL `table`을 GFM 표로 쓴다 — 첫 행을 머리 줄로, 구분 줄은 열마다 `---`(정렬 없음) · `:-:`(center) · `--:`(right), 이어 본문 줄. 줄마다 앞뒤에 `|`를 두고 칸 사이는 공백 · `|` · 공백이다. 칸 글자는 문단과 같은 인라인 규칙으로 쓰되 줄 첫 글자 규칙은 쓰지 않고, 모든 `|`(코드 마크 · 링크 주소 안 포함)를 `\|`로 쓴다. 빈 칸은 비워 둔다. 표 꾸미기와 스티커는 다른 블록처럼 지시어 줄로 쓴다. losses가 없는 표는 왕복해도 같다. 표 칸 · 제목은 한 줄 문법이라, 줄바꿈이 든 코드 마크 글자는 코드 마크를 빼고 글자로 쓰고(줄바꿈은 `&#10;`) losses에 `codeMark`로 센다.

#### Scenario: 정렬 · 파이프 · 빈 칸이 있는 표를 쓴다

- **WHEN** 머리 행 `a` · `b`(`align: "right"`), 본문 행 `x|y`(코드 마크) · 빈 칸인 표를 직렬화한다
- **THEN** `markdown`의 세 줄이 `| a | b |` · `| --- | --: |` · ``| `x\|y` |  |``이고, 다시 변환하면 원래 doc와 같다

#### Scenario: 칸 · 제목 안 코드의 줄바꿈은 줄을 끊지 않는다

- **WHEN** 코드 마크 `a\nb`인 제목(level 2)과 코드 마크 `c\nd`인 칸 하나짜리 표를 직렬화한다
- **THEN** `markdown`이 `## a&#10;b` · 빈 줄 · `| c&#10;d |` · `| --- |`이고, losses가 두 블록에 `codeMark` 1씩이며, 다시 변환하면 코드 마크만 빠진 같은 글자가 된다

## ADDED Requirements

### Requirement: losses가 없는 doc는 스티커까지 왕복해도 같다

`serializeMarkdown`은 SHALL `losses`가 비는 모든 유효 doc(빈 문단 · 참조 정의로 읽히는 코드 마크가 없음 — 스티커는 있어도 된다)에서 `convertMarkdown(serializeMarkdown(doc).markdown)`이 성공하고 그 doc가 `normalize(doc)`와 같게 한다. 링크 href만 예외다 — 변환이 markdown-it `normalizeLink`(mdurl)로 퍼센트 인코딩하는 글자(보존 집합 — 영숫자 · `;/?:@&=+$,-_.!~*'()#` · 유효한 `%XX` — 밖의 모든 글자: 비ASCII · `[` `]` `` ` `` `"` `^` `{` `|` `}` 등, 그리고 punycode로 바뀌는 호스트 이름)가 든 주소는 같은 뜻의 인코딩된 문자열로 돌아오며, 이는 losses가 아니다. 예제가 아니라 생성된 doc 전체에 대해 성립해야 하므로 속성 기반 테스트(fast-check, adr-012)로 검사한다.

#### Scenario: 임의의 doc가 왕복해도 같다

- **WHEN** 문법 글자 · 한글 · 공백 · 줄바꿈이 섞인 글자와 마크 조합을 가진 임의의 유효 doc(스티커 포함, 빈 문단 · 코드 마크 속 `]:` 없음)을 생성해 직렬화한 뒤 변환한다
- **THEN** 매번 `losses`가 비고, 변환이 성공하고, 결과가 `normalize(doc)`와 깊은 비교로 같다

#### Scenario: 참조 정의로 읽히는 코드 마크는 빠지고 목록에 남는다

- **WHEN** 문단 하나가 `]:`(code · link `/x`) + `뒤`인 doc을 직렬화한다
- **THEN** `markdown`이 `[\]:](/x)뒤\n`이고 `losses`가 `[{ block: 1, kind: "codeMark", count: 1 }]`이며 다시 변환하면 성공한다

#### Scenario: 링크 주소의 `&`는 글자 그대로 돌아온다

- **WHEN** 문단 "가"(link `/a&amp;b`) · 문단 "나"(link `/&#x2F;evil.com`)를 직렬화한 뒤 다시 변환한다
- **THEN** 변환이 성공하고 두 href가 `/a&amp;b` · `/&#x2F;evil.com` 그대로다(문자 참조로 풀리지 않는다)

#### Scenario: 첫 문단이 빈 항목의 안쪽 목록은 한 단계 위로 올라간다

- **WHEN** 글머리 목록 항목 셋 — "가" · (빈 문단 + 안쪽 글머리 목록 "나") · "다" — 을 직렬화한다
- **THEN** `markdown`이 `- 가\n\n* 나\n\n- 다\n`이고 `losses`가 `[{ block: 1, kind: "emptyParagraph", count: 1 }]`이며, 다시 변환하면 글머리 목록 셋("가" · "나" · "다")이 된다

#### Scenario: 스티커는 지시어로 나르고, 빠지는 블록의 스티커만 목록에 남는다

- **WHEN** 스티커 2개(`heart` 90 · 10 · 12 · 15, `cloud` -5 · 40 · 8 · 0)가 붙은 문단 "가"(블록 1) · 스티커 1개가 붙은 빈 문단(블록 2) · 항목 문단이 빈 글머리 목록(블록 3)을 직렬화한다
- **THEN** `markdown`이 `{sticker=heart@90,10,12,15 sticker=cloud@-5,40,8,0}\n가\n`이고 `losses`가 `[{ block: 2, kind: "stickers", count: 1 }, { block: 2, kind: "emptyParagraph", count: 1 }, { block: 3, kind: "emptyParagraph", count: 1 }]`다

실패 의미론: 해당 없음 — 순수 변환(서버 상태 없음).

## REMOVED Requirements

### Requirement: losses가 없는 doc는 왕복해도 같다

**Reason**: 스티커가 지시어로 오가게 되어(adr-032) "losses가 없는 doc는 스티커까지 왕복해도 같다"로 대신한다.

**Migration**: 같은 속성 테스트가 스티커를 포함해 새 요구사항을 검사한다.
