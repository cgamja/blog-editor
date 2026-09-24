# decoration-v2-recheck (PR #77 재검사 반영)

## Why

재검사에서 기존 구멍이 나왔다. 폭(`--w`)과 스티커 좌표(`--x/--y/--s/--r`)는 이스케이프만 거쳐서, 검증을 건너뛴 doc가 `;`로 style에 다른 선언을 이을 수 있었다. 앞 change가 스펙 끝의 "실패 의미론" 줄을 떨어뜨린 것도 되살린다.

## What Changes

- render-safety: 정수 CSS 변수는 값이 정수(number)가 아니면 `RangeError`를 던진다. 시나리오를 하나 추가하고 "실패 의미론" 줄을 복원한다

## Impact

보안 테스트를 추가한다. 기존 단언은 그대로다. 사람 승인이 필요하다.
