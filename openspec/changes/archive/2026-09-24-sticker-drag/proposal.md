# sticker-drag (이슈 #61)

## Why

#57이 스티커 커맨드를, #58이 에디터 안 스티커 그리기를 만들었다. 하지만 사용자는 아직 스티커를 고르거나 옮기거나 크기를 바꿀 수 없다. plan 3-13은 "아무 데나 끌어다 놓으면 가장 가까운 블록에 붙는다"이다. 디자인 결정(이슈 #61 코멘트)은 다음과 같다: 고른 스티커 = 점선 테두리 + 모서리 조절점 + 회전 손잡이 + × + 「…에 붙어 있어요」 꼬리표. 포인터 전용 손잡이이므로 키보드 대체가 필요하다.

## What Changes

- editor-core(순수)
  - `stickerKeyCommand(ref, key)`: 키 하나 → 스티커 커맨드. 방향키는 x · y ±1, `+` `=` `-`는 크기 ±1, `[` `]`는 회전 ∓15°(±180에서 감긴다), Delete · Backspace는 지운다. 모르는 키면 null
  - `mapStickerRef(ref, mapping, doc)`: 트랜잭션 뒤 고른 스티커 참조를 옮긴다. 블록이 지워졌거나 순번이 없으면 null
  - `placeStickerNear(blocks, point, stickerWidth)`: 놓은 점 → 붙을 블록과 % 좌표. 딱 맞는 블록이 없으면 24px 안에서 가장 가까운 허용 자리로 스냅하고, 그보다 멀면 null
- editor-react
  - `StickerLayer`: 에디터 위 오버레이
    - 스티커마다 포커스할 수 있는 버튼(`<이름> 스티커`)을 둔다
    - 고른 스티커에 점선 테두리 · 모서리 조절점 · 회전 손잡이 · × · 꼬리표를 보여 준다
    - 포인터로 옮기기 · 크기 · 회전을 할 수 있다. 끄는 동안은 유령 이미지로만 미리 보여 주고, 놓을 때 트랜잭션 1번이다
    - 키보드로도 조작한다
    - 상태 메시지(`role=status`)를 낸다
  - 패널 격자에서 끌어 오기: `writeStickerDrag` · `readStickerDrag`(dataTransfer 형식)와 handleDrop 플러그인. 격자 쪽 연결은 #60 머지 뒤
  - 순수 헬퍼: 스티커 이름 · 꼬리표 문구 · 크기/회전 제스처 계산

## Impact

- editor-core 새 파일 `src/commands/sticker-edit.ts`(+ 테스트), `index.ts` export
- editor-react 새 파일 `src/sticker-ui.ts`(+ 테스트) · `src/StickerLayer.tsx`, `BlogEditor.tsx` · `editor.css` 변경
- 새 의존성 없음 · 보호 파일 변경 없음
- 하지 않는 것
  - 패널 격자의 draggable 연결(#60 몫)
  - 여러 스티커 한꺼번에 고르기
  - 스티커를 블록 밖 자유 좌표로 두기(adr-008)
