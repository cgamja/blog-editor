## ADDED Requirements

### Requirement: 괄호 span은 겹쳐 쓸 수 없고, 대체 글자 안에서는 글자다

변환은 SHALL 괄호 span 안의 괄호 span을 거부한다. 거부 메시지에는 줄 번호와 고치는 법(나란히 나눠 각자 키를 적는다)을 담는다. 겹친 span은 바깥 스타일이 안쪽 글자에 이어지지 않아 조용히 사라지기 때문이다. 이미지 대체 글자 안의 괄호 span 모양은 해석하지 않고 원문 그대로 `alt`가 된다. 대체 글자에는 마크 자리가 없기 때문이다.

#### Scenario: 겹친 span은 실패한다

- **WHEN** 3줄째에 `[[가]{color=brand} 나]{size=lg}`를 쓴 markdown을 변환한다
- **THEN** 실패하고, 메시지 하나가 `(3줄)`과 "겹쳐 쓸 수 없"을 담는다

#### Scenario: 대체 글자 안 span 모양은 원문 그대로다

- **WHEN** `![[강조]{color=brand} 화면](/images/a.webp)`를 변환한다
- **THEN** 이미지 `alt`가 `[강조]{color=brand} 화면`이다
