## ADDED Requirements

### Requirement: 최상위 목록의 첫 항목을 빼내면 간격은 빠져나온 블록이 갖는다

editor-core는 SHALL 간격(`space`)이 있는 최상위 목록의 첫 항목을 빼낼 때(Shift-Tab · 맨 앞 Backspace · 빈 첫 항목 Enter) 간격을 원래 목록 자리의 첫 최상위 블록에 두고 남은 목록에서는 지운다 — 간격은 원래 목록 위 자리라 빠져나온 블록과 남은 목록 사이가 넓게 띄지 않는다. 스티커 · 움직임은 남은 목록이 그대로 가진다.

#### Scenario: 간격 · 스티커 목록 첫 항목을 빼낸다

- **WHEN** 문단 `앞` 뒤의 `space: lg` · 스티커 1개 점 목록 [첫 항목, 나]에서 첫 항목 맨 앞 Shift-Tab · 맨 앞 Backspace · (첫 항목이 비었을 때) Enter 가운데 하나로 첫 항목을 빼낸다
- **THEN** 빠져나온 문단이 `space: lg`만 갖고, 남은 목록 [나]는 `space` 없이 스티커 1개를 갖는다
