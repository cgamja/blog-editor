## ADDED Requirements

### Requirement: 표는 머리 행과 본문으로 나눈 table로 낸다

`renderHtml`은 SHALL `table`을 `<div class="post-table-scroll"><table><thead><tr>…</tr></thead><tbody>…</tbody></table></div>`로 낸다(adr-028). 첫 행은 `<thead>` 안 `<th scope="col">`, 나머지 행은 `<tbody>` 안 `<td>`다. 본문 행이 없으면 `<tbody>`를 내지 않는다. 열 정렬은 그 열의 모든 칸에 `data-align="center|right"`로 낸다(`style`은 쓰지 않는다). 칸 안 문단은 `<p>` 없이 인라인만 낸다. 표 꾸미기는 다른 블록처럼 `div.post-block`으로 감싼다.

#### Scenario: 정렬 열이 있는 표

- **WHEN** 머리 행 `이름` · `값`(`align: "right"`), 본문 행 `가` · `1`인 표를 렌더한다
- **THEN** 출력이 `<div class="post-table-scroll"><table><thead><tr><th scope="col">이름</th><th scope="col" data-align="right">값</th></tr></thead><tbody><tr><td>가</td><td data-align="right">1</td></tr></tbody></table></div>`다
