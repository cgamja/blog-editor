## ADDED Requirements

### Requirement: 붙여넣은 HTML은 닫힌 집합으로만 읽힌다

붙여넣기 파싱 규칙은 SHALL 문서에 자리가 없는 모양을 받지 않는다. 구글 독스가 전체를 감싸는 `<b style="font-weight:normal">`는 굵게가 아니고, `font-weight`가 700 이상이거나 `bold`인 `span`은 굵게다. 허용 목록(`hrefSchema`) 밖 링크(`javascript:` 등)는 마크가 되지 않는다(글자는 남는다). 경로 규칙(`imagePathSchema`) 밖 이미지(절대 URL · `data:`)는 노드가 되지 않는다. 표(`table` · `tr` · `td` · `th`)를 받는 규칙은 없다(칸의 글자는 문단으로 읽힌다). `h1`은 가장 높은 제목(2), `h4`~`h6`은 가장 낮은 제목(3)이 된다.

#### Scenario: 구글 독스의 감싸는 b 태그는 굵게가 아니다

- **WHEN** `<b style="font-weight:normal;" id="docs-internal-guid-1">`와 `<span style="font-weight:700">`을 굵게 규칙으로 읽는다
- **THEN** 앞의 것은 굵게가 아니고 뒤의 것은 굵게다

#### Scenario: 허용 목록 밖 링크와 외부 이미지는 받지 않는다

- **WHEN** `<a href="javascript:alert(1)">` · `<img src="https://example.com/a.png">` · `<img src="data:image/png;base64,AA">`를 읽는다
- **THEN** 링크 규칙과 이미지 규칙이 모두 거부한다

#### Scenario: 표는 표로 들어오지 않는다

- **WHEN** 스키마의 파싱 규칙에서 `table` · `tr` · `td` · `th`를 받는 규칙을 찾는다
- **THEN** 없다

#### Scenario: 허용되지 않는 제목 수준은 가까운 수준으로 읽힌다

- **WHEN** `h1` · `h2` · `h3` · `h4` · `h6`을 읽는다
- **THEN** 수준이 차례로 2 · 2 · 3 · 3 · 3이다

### Requirement: 붙여넣은 조각은 넣을 자리에 맞게 정규화된다

`normalizePastedSlice(slice, { intoTopLevel })`와 이것을 `transformPasted`로 거는 `pasteNormalizer()` 플러그인은 SHALL 조각을 저장 가능한 모양으로 만든다. 스티커는 늘 지운다. 인용 · 목록 · 콜아웃 안에 붙이면(`intoTopLevel: false`) 꾸밈을 모두 지우고, 최상위에 붙이면 안쪽 노드의 꾸밈만 지운다. 허용 목록 밖 링크 마크는 지우고 글자는 남긴다. 경로 규칙 밖 이미지 · 앱 스크린샷 노드는 지운다. 짝이 깨진 원본 크기는 둘 다 지운다. 플러그인은 붙일 자리를 선택으로 판단한다. 노드 선택이면 그 노드가 최상위일 때(`$from.depth === 0`), 그 밖에는 깊이 1 이하일 때 최상위다. 에디터 안에서 끌어 옮기는 경우(`view.dragging.move`)는 정규화하지 않는다. 내부 조각이라 이미 저장 가능한 모양이고, 스티커를 지우면 옮기다가 데이터를 잃는다. 안쪽 자리에 떨어뜨려 무효가 되면 blockGuard가 거부한다. 플러그인은 `PasteNormalizer` 확장으로 `editorExtensions`에 들어 있어 에디터를 마운트하면 켜진다.

#### Scenario: 안쪽에 붙이면 꾸밈과 스티커가 사라진다

- **WHEN** 꾸밈 · 스티커가 있는 문단 둘로 된 조각을 `intoTopLevel: false`로 정규화하고 인용 안에 넣는다
- **THEN** 두 문단에 꾸밈 · 스티커가 없고 결과 문서가 `docFromNode`를 통과한다

#### Scenario: 최상위에 붙이면 유효한 꾸밈은 남고 스티커는 사라진다

- **WHEN** 최상위 문단과 인용(안 문단에 꾸밈)으로 된 조각을 `intoTopLevel: true`로 정규화하고 최상위에 넣는다
- **THEN** 최상위 문단의 꾸밈은 남고 스티커는 없으며, 인용 안 문단의 꾸밈은 없고 결과 문서가 `docFromNode`를 통과한다

#### Scenario: 허용 목록 밖 링크와 경로 밖 이미지를 걸러 낸다

- **WHEN** `javascript:` 링크 마크가 붙은 글자, 절대 URL 이미지, 원본 크기가 한쪽만 있는 이미지로 된 조각을 정규화한다
- **THEN** 글자는 남고 링크 마크는 없으며, 절대 URL 이미지는 없고, 남은 이미지에는 원본 크기가 없다

#### Scenario: 인용 안 문단을 노드 선택하고 붙이면 안쪽 자리로 본다

- **WHEN** 인용 안 문단을 노드 선택한 채 꾸밈이 있는 문단 조각을 플러그인으로 붙인다
- **THEN** 붙은 문단에 꾸밈이 없다

#### Scenario: 에디터 안에서 끌어 옮기면 정규화하지 않는다

- **WHEN** `view.dragging.move`가 참인 상태에서 스티커가 있는 문단 조각이 플러그인을 지난다
- **THEN** 조각이 그대로이고 스티커가 남아 있다
