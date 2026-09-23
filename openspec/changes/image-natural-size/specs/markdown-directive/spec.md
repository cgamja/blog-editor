## ADDED Requirements

### Requirement: `{size=<가로>x<세로>}`는 이미지의 원본 픽셀 크기다

변환은 SHALL 이미지 앞 지시어의 `size=<가로>x<세로>`(각각 `1`~`1600` 정수, 앞자리 0 없이)를 `naturalWidth` · `naturalHeight`로 옮긴다. 이미지 · 앱 스크린샷에만 쓸 수 있고 다른 블록에서는 키 불가 오류, 모양 · 범위가 틀리면 값 오류 메시지가 된다. `frame` · `motion` · `width`와 같이 쓸 수 있다.

#### Scenario: size 지시어가 원본 크기가 된다

- **WHEN** `{frame=app size=1179x1600}` 줄 뒤에 `![화면](/images/s.webp)`를 쓴다
- **THEN** `{ type: "appScreenshot", attrs: { src: "/images/s.webp", caption: "화면", naturalWidth: 1179, naturalHeight: 1600 } }`가 나온다

#### Scenario: 틀린 size는 실패한다

- **WHEN** 이미지 앞에 `{size=1200}` · `{size=0x10}` · `{size=1601x10}`을 각각 쓰고, 문단 앞에 `{size=10x10}`을 쓴다
- **THEN** 네 경우 모두 변환이 실패하고 메시지에 `size`가 있다
