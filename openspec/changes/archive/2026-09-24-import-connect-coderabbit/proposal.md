# import-connect-coderabbit (PR #105 CodeRabbit)

## Why

계약은 미리보기 요청 본문에 `additionalProperties: false`라고 적었는데 런타임은 모르는 키를 받았다.

## What Changes

- import-preview-api: 요청 본문은 `markdown` 하나뿐이고 모르는 키는 400

## Impact

- 테스트 하나 추가
