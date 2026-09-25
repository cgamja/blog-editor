## MODIFIED Requirements

### Requirement: 슬래시 메뉴 목록과 키보드

editor-react는 SHALL 순수 함수 `filterSlashItems(query)`로 「+」 메뉴와 같은 목록(`INSERTABLE_BLOCKS` 순서)을 한글 이름(`INSERTABLE_BLOCK_LABELS`)과 영문 별칭(`SLASH_ALIASES`)의 부분 일치(대소문자 무시)로 거른다. 이름의 공백 · `·`은 빼고 비교한다. 한글은 자모로 풀어 비교한다 — 조합 중인 글자(`ㅈ`, `젬`)도 완성된 이름(`제목` = ㅈㅔㅁㅗㄱ)의 일부로 맞는다. `BlogEditor`는 SHALL 메뉴가 열리면 커서 아래에 listbox를 띄우고, 에디터 포커스를 둔 채 `aria-activedescendant`로 고른 항목을 알리며, ↑↓로 옮기고 Enter · Tab으로 적용하고 Esc로 닫는다. 일치 항목이 없으면 닫는다. 실브라우저로 확인한다.

#### Scenario: 한글 이름과 영문 별칭으로 거른다

- **WHEN** `filterSlashItems("제목")`, `filterSlashItems("h2")`, `filterSlashItems("HR")`, `filterSlashItems("")`, `filterSlashItems("없는말")`, `filterSlashItems("table")`
- **THEN** 큰 제목 · 작은 제목, 큰 제목, 구분선, 전체 11개(마지막은 「표」), 빈 목록, 표다

#### Scenario: 조합 중인 한글로도 거른다

- **WHEN** `filterSlashItems("ㅈ")`, `filterSlashItems("젬")`, `filterSlashItems("으")`
- **THEN** 앞 둘은 큰 제목 · 작은 제목(과 ㅈ이 든 다른 이름)을 포함하고, 셋째는 콜아웃 · 주의를 포함한다

#### Scenario: 키보드로 고른다

- **WHEN** 실브라우저에서 빈 문단에 `/h`를 치고 ↓ 뒤 Enter
- **THEN** 걸러진 목록의 둘째 항목이 적용되고 `/h`는 사라진다

#### Scenario: 띄어 쓰지 않은 이름으로도 거른다

- **WHEN** `filterSlashItems("큰제목")`, `filterSlashItems("점목록")`, `filterSlashItems("콜아웃메모")`
- **THEN** 큰 제목, 점 목록, 콜아웃 · 메모다
