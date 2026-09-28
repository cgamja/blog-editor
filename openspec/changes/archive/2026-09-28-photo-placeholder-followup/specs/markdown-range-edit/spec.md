## ADDED Requirements

### Requirement: 여러 블록 바꾸기는 사진 설명을 같은 src 그림으로 옮기거나 실패로 알린다

`editDocRange`는 SHALL 여러 블록 `replace`가 사진 설명(brief)이 있는 그림을 덮을 때, 새 markdown에 같은 src 그림이 있으면 brief를 그 그림으로 옮기고, 없으면 실패한다(adr-039). 실패 메시지에는 그림 src와 블록 번호, 같은 src로 다시 쓰면 설명이 옮겨진다는 안내가 있다. 빈 markdown으로 지우기는 막지 않는다.

#### Scenario: 같은 src 그림이 있으면 brief가 옮겨진다

- **WHEN** 앞 문단부터 뒤 문단까지를 같은 src 그림이 든 markdown으로 바꾼다
- **THEN** 새 그림이 옛 brief를 가진다

#### Scenario: 같은 src 그림이 없으면 실패한다

- **WHEN** 같은 범위를 그 src 그림이 없는 markdown으로 바꾼다
- **THEN** 실패이고 메시지에 그림 src와 블록 번호가 있으며 문서는 그대로다

#### Scenario: 같은 src 그림 둘을 하나로 바꾸면 짝 없는 그림 때문에 실패한다

- **WHEN** 같은 src brief 그림 둘을 그 src 그림 하나로 바꾼다
- **THEN** 실패이고 메시지에 짝 없는 그림의 블록 번호가 있다

#### Scenario: 빈 markdown으로 지우기는 막지 않는다

- **WHEN** brief 그림을 덮는 범위를 빈 markdown으로 지운다
- **THEN** 성공하고 그림도 지워진다
