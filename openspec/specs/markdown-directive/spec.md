# markdown-directive Specification

## Purpose

블록 꾸미기 속성(font · motion · width) · 블록 스티커(`sticker=`, adr-032)와 앱 스크린샷 프레임을 markdown에서 주는 지시어 줄 `{key=value …}`. 범위는 markdown-format과 같다(MCP 입력).

## Requirements

### Requirement: 지시어 줄은 바로 다음 최상위 블록 하나의 attrs가 된다

변환은 SHALL 최상위 블록 바로 앞 줄(빈 줄 없이)의 `{font=… motion=… width=…}`를 그 블록 하나의 `attrs`로 옮긴다. 지시어 줄은 markdown 문법에 **앞서** 줄 단위로 걷어내 **빈 줄로 바꾸고**(줄 번호 보존) 다음 블록에 귀속된다 — 그래서 문단 글자 줄 바로 뒤의 지시어는 그 문단을 끝내고 다음 블록을 연다(`첫 문단` · `{font=jua}` · `둘째 줄`은 문단 둘이고 둘째에 `font`). 코드 펜스 안의 `{…}` 줄은 코드 글자로 남는다. 값의 집합은 decoration-schema와 같다: `font` pretendard · jua · gaegu(문단 · 제목 · 목록 · 인용 · 콜아웃에만), `motion` fade-in · fade-up · slide-left · slide-right · pop(모든 블록), `width` `%` 없는 정수 25~100(이미지 · 앱 스크린샷에만). 지시어 줄은 doc에 글자로 남지 않는다. 문단 첫 줄이 우연히 `{a=b}`이면 `\{`로 이스케이프한다.

#### Scenario: 지시어가 바로 다음 블록 하나의 attrs가 된다

- **WHEN** `{font=jua motion=fade-up}` 줄 뒤에 `## 베타 테스트를 시작합니다`, 빈 줄, `이 문단에는 지시어가 적용되지 않는다.`를 쓴다
- **THEN** 제목만 `attrs: { level: 2, font: "jua", motion: "fade-up" }`이고 문단에는 `attrs`가 없으며, 두 블록의 글자에 `{…}`가 남지 않는다

#### Scenario: 지시어 다음 줄의 `---`는 제목이 아니라 구분선이다

- **WHEN** `{motion=pop}` 줄 뒤에 `---`를 쓴다
- **THEN** `{ type: "horizontalRule", attrs: { motion: "pop" } }`가 나온다

#### Scenario: 문단 바로 뒤 지시어는 문단을 끝내고 다음 블록에 붙는다

- **WHEN** `첫 문단` · `{motion=pop}` · `---` 세 줄을 쓴다
- **THEN** `paragraph`("첫 문단")와 `{ type: "horizontalRule", attrs: { motion: "pop" } }` 두 블록이 나오고 제목이 되지 않는다

#### Scenario: 코드 펜스 안의 지시어 모양은 코드 글자다

- **WHEN** ``` 펜스 안에 `{font=jua}` 줄을 쓴다
- **THEN** `codeBlock`의 텍스트에 `{font=jua}`가 그대로 있고 `attrs.font`는 없다

#### Scenario: 이스케이프한 중괄호는 문단 글자다

- **WHEN** 문단 첫 줄을 `\{a=b}`로 쓴다
- **THEN** 텍스트 `{a=b}`인 `paragraph`가 나오고 변환이 실패하지 않는다

### Requirement: `{frame=app}`는 바로 뒤 이미지를 앱 스크린샷으로 만든다

변환은 SHALL `{frame=app}` 지시어 뒤의 `![캡션](/images/…)`를 `appScreenshot`으로 만들고 alt를 `caption`(≤ 120자)으로 쓴다. `width`와 같이 쓸 수 있다.

#### Scenario: frame=app 이미지는 appScreenshot이 된다

- **WHEN** `{frame=app width=60}` 줄 뒤에 `![오늘의 수유 기록 화면](/images/record-screen.webp)`를 쓴다
- **THEN** `{ type: "appScreenshot", attrs: { src: "/images/record-screen.webp", caption: "오늘의 수유 기록 화면", width: 60 } }`가 나온다

### Requirement: 정의 밖 · 자리 밖 · 떨어진 지시어는 거부한다

변환은 SHALL 정의 밖 키(`stickers` · `color` 등) · 정의 밖 값 · 자리 밖 속성(코드 블록의 `font` · 문단의 `width`) · 떨어진 지시어(문서 끝 · 빈 줄 뒤에 블록이 없음 — `문서 (<m>줄)` 형식) · 목록 · 인용 · 콜아웃 **안**의 지시어(안쪽 노드는 attrs가 없다) · 같은 키 중복(`sticker`는 되풀이할 수 있다) · 연속 지시어 두 줄 · `frame=app` 뒤가 이미지가 아님 · `frame` 값이 `app`이 아님 · 앱 스크린샷의 `font`를 거부한다. 스티커는 `sticker=` 키로 쓴다(복수형 `stickers`는 정의 밖 키다).

#### Scenario: 정의 밖 · 자리 밖 · 떨어진 지시어는 전부 거부한다

- **WHEN** `{stickers=heart}` · `{color=red}` · `{font=comic}` · `{width=60%}` · ``` 펜스 앞 `{font=jua}` · 문단 앞 `{width=60}` · 문서 끝(5줄째) `{motion=pop}` · `{motion=pop}` 뒤 빈 줄 · 목록 항목 안 `{font=jua}` · 인용 안 `{font=jua}` · 콜아웃 안 `{font=jua}` · `{font=jua font=gaegu}` · `{font=jua}` 다음 줄 `{motion=pop}` · `{frame=app}` 뒤 문단 · `{frame=phone}` · `{frame=app font=jua}` 뒤 이미지를 각각 넣는다
- **THEN** 열여섯 경우 모두 변환이 실패하고, 문서 끝 `{motion=pop}`의 메시지 문자열은 정확히 `문서 (5줄): 지시어 뒤에 블록이 없다(받음: "{motion=pop}") → 지시어 줄을 지우거나 바로 아래에 블록을 쓴다`이다

실패 의미론: 해당 없음 — 순수 변환(서버 상태 없음).

### Requirement: `{size=<가로>x<세로>}`는 이미지의 원본 픽셀 크기다

변환은 SHALL 이미지 앞 지시어의 `size=<가로>x<세로>`(각각 `1`~`1600` 정수, 앞자리 0 없이)를 `naturalWidth` · `naturalHeight`로 옮긴다. 이미지 · 앱 스크린샷에만 쓸 수 있고 다른 블록에서는 키 불가 오류, 모양 · 범위가 틀리면 값 오류 메시지가 된다. `frame` · `motion` · `width`와 같이 쓸 수 있다.

#### Scenario: size 지시어가 원본 크기가 된다

- **WHEN** `{frame=app size=1179x1600}` 줄 뒤에 `![화면](/images/s.webp)`를 쓴다
- **THEN** `{ type: "appScreenshot", attrs: { src: "/images/s.webp", caption: "화면", naturalWidth: 1179, naturalHeight: 1600 } }`가 나온다

#### Scenario: 틀린 size는 실패한다

- **WHEN** 이미지 앞에 `{size=1200}` · `{size=0x10}` · `{size=1601x10}`을 각각 쓰고, 문단 앞에 `{size=10x10}`을 쓴다
- **THEN** 네 경우 모두 변환이 실패하고 메시지에 `size`가 있다

### Requirement: 알려진 키의 빈 값은 지시어 값 오류다

변환은 SHALL 줄 전체가 `{…}`이고 모든 토큰이 `키=값` 또는 **알려진 키**(`frame` · `font` · `motion` · `align` · `width` · `size` · `sticker`)의 `키=`(빈 값)인 줄을 지시어 줄로 걷어내고, 빈 값은 그 키의 값 오류 메시지(받음 `""`)로 거부한다. 첫 토큰이 **알려진 키**의 `키=…`인 `{…}` 줄은 지시어를 쓰려던 줄로 보고 걷어낸다. 그 줄에 `키=값` 모양이 아닌 토큰(값 안 공백으로 깨진 조각 등)이 있으면 글자로 흘리지 않고 "공백 없이"를 담은 값 오류로 거부한다(`{size=1200 x800}` · `{sticker=heart@1, 2,3}`). 첫 토큰이 알 수 없는 키인 줄(`{foo=}` · `{foo=1 x2}`)은 지시어가 아니라 글자로 남는다.

#### Scenario: 알려진 키의 빈 값은 실패한다

- **WHEN** 알맞은 블록 앞에 `{frame=}` · `{font=}` · `{motion=}` · `{width=}` · `{size=}`를 각각 쓴다
- **THEN** 다섯 경우 모두 변환이 실패하고 메시지에 그 키가 있다

#### Scenario: 알 수 없는 키의 빈 값은 글자로 남는다

- **WHEN** 문단 앞 줄에 `{foo=}`를 쓴다
- **THEN** 변환은 성공하고 `{foo=}`가 문단 글자로 남는다

#### Scenario: 알려진 키로 시작한 지시어 값 안 공백은 실패한다

- **WHEN** 문단 앞 줄에 `{sticker=heart@1, 2,3}` · `{font=jua sticker=heart@1, 2,3}` · `{size=1200 x800}`를 각각 쓴다
- **THEN** 세 경우 모두 변환이 실패하고 메시지에 "공백 없이"가 있으며, 고친 예는 그 줄의 첫 키를 따른다(`{size=1200 x800}`이면 `size=1200x800`)

#### Scenario: 알 수 없는 키로 시작하고 공백이 끼는 줄은 글자로 남는다

- **WHEN** 문단 앞 줄에 `{foo=1 x2}`를 쓴다
- **THEN** 변환은 성공하고 `{foo=1 x2}`가 문단 글자로 남는다

### Requirement: `{align=…}`는 문단 · 제목 · 이미지의 정렬이다

지시어 키 `align`은 SHALL `left` · `center` · `right` 중 하나를 받는다. 문단 · 제목 · 이미지(앱 스크린샷 포함) 앞에서만 쓸 수 있다. 다른 블록 앞이나 정의 밖 값이면 지시어 값 오류로 거부한다.

#### Scenario: 정렬이 attrs가 된다

- **WHEN** `{align=center}` + 문단, `{frame=app align=right}` + 이미지를 변환한다
- **THEN** 문단 `attrs.align === "center"`, appScreenshot `attrs.align === "right"`

#### Scenario: 자리 밖 · 정의 밖 정렬은 거부한다

- **WHEN** `{align=center}` + `- 목록`, `{align=justify}` + 문단을 각각 변환한다
- **THEN** 둘 다 실패한다

### Requirement: `sticker=` 지시어는 블록 스티커가 된다

변환은 SHALL 최상위 블록 지시어의 `sticker=<종류>@<x>,<y>,<크기>[,<회전>]`를 그 블록 `attrs.stickers`의 한 항목으로 옮긴다(adr-032).

- 같은 줄에 여러 번 쓸 수 있고, 쓴 순서가 배열 순서다. 같은 키 중복 규칙에서 `sticker`만 빠진다.
- 종류는 `STICKER_IDS`, 좌표 · 크기 · 회전은 `STICKER_RANGES` 안의 정수다(decoration-schema, adr-008 — 좌표는 스티커 가운데의 블록 기준 %, 크기는 블록 폭 %, 회전은 도). 회전을 빼면 0이다.
- 모든 최상위 블록(문단 · 제목 · 목록 · 인용 · 콜아웃 · 코드 블록 · 구분선 · 이미지 · 앱 스크린샷 · 표)에 쓸 수 있고, 다른 키와 같이 쓸 수 있다.
- 종류가 목록 밖이면 종류 목록을, 모양 · 범위가 틀리면 올바른 모양과 범위를 알려 주는 블록 메시지로 거부한다.
- 글 전체 변환에서 문서 전체 스티커가 `MAX_STICKERS_PER_DOC`(12)를 넘으면, 넘기 시작한 지시어 줄의 문서 메시지로 거부한다(부분 고치기는 합친 문서를 docSchema로 검사한다).

#### Scenario: 스티커 지시어는 블록 스티커가 된다

- **WHEN** `{font=jua sticker=heart@90,10,12,15 sticker=star-mint@-5,40,8}` 다음 줄에 문단 `가`를 변환한다
- **THEN** 문단 attrs가 `{ font: "jua", stickers: [{ id: "heart", x: 90, y: 10, size: 12, rotate: 15 }, { id: "star-mint", x: -5, y: 40, size: 8, rotate: 0 }] }`이다

#### Scenario: 이미지 · 표에도 스티커를 쓴다

- **WHEN** `{width=60 sticker=cloud@100,0,10,0}` 다음 줄에 이미지, `{sticker=bottle@50,50,6,-30}` 다음 줄에 표를 변환한다
- **THEN** 이미지와 표 attrs에 각 스티커가 하나씩 들어간다

#### Scenario: 틀린 스티커 값은 고칠 방법과 함께 거부한다

- **WHEN** `{sticker=dog@1,2,3}` · `{sticker=heart@1,2}` · `{sticker=heart@200,0,10}` · `{sticker=heart@0,0,1}` · `{sticker=heart@0,0,10,181}` · `{sticker=heart@1.5,0,10}` 다음 줄에 문단을 각각 변환한다
- **THEN** 여섯 경우 모두 실패하고, 종류 오류 메시지에는 종류 목록이, 나머지에는 `sticker=<종류>@<x>,<y>,<크기>[,<회전>]` 모양과 `STICKER_RANGES`의 범위(`-25~125` 등)가 들어 있다

#### Scenario: 문서 스티커가 12개를 넘으면 거부한다

- **WHEN** 문단 두 개에 스티커를 7개 · 6개 지시어로 붙여 변환한다
- **THEN** 변환이 실패하고 메시지가 넘기 시작한 지시어 줄 `문서 (4줄)`로 시작하며 12개 상한을 말한다

실패 의미론: 해당 없음 — 순수 변환(서버 상태 없음).
