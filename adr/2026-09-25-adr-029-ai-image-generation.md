# ADR-029. AI 이미지는 서비스가 아니라 사용자 쪽 에이전트가 Codex CLI(ChatGPT 구독)로 만들어 올린다

- 날짜: 2026-09-25
- 상태: 제안됨
- 원천: 이슈 #137(스파이크) · #136(사진 자리) · #141(`/blog-write`) · adr-007 · adr-021
- 대체(승인되면): adr-007의 두 구절만 대체한다. 결정 절 "**2단계**: … AI 이미지 생성 …"에서 "AI 이미지 생성"을 떼어 1단계로 당기고, 트레이드오프 절 "채팅에서 만든 이미지를 커넥터로 넘기는 길이 아직 없다. 이미지는 1단계에서 사람이 올린다"를 이 ADR로 바꾼다. "서비스가 LLM을 호출하지 않는다" · "발행은 사람"은 그대로다.

## 문제 (맥락)

사용자는 블로그를 AI로 자동화하려 한다(2026-09-25). 주제를 주면 리서치 · 글 · 꾸밈 · SEO까지 AI가 하고, 사람은 방향 확인과 발행만 한다. 이미지는 두 가지로 정했다.

- AI가 **사진 자리**(설명 글만)를 남기고 사람이 채운다(#136).
- **AI가 직접 만든다.**

Claude는 이미지를 만들지 못하므로 다른 이미지 모델이 필요하다. adr-007은 "서비스가 모델을 부르지 않는다(비용 0원)"와 "AI 이미지 생성은 2단계"를 정해 두었다. 그래서 두 가지를 정해야 한다. **누가 모델을 부르고 누가 돈을 내는가**, 그리고 우리 제약(adr-021: 긴 변 1600px · 1MiB · JPEG/PNG/WebP · 서버는 줄이지 않는다)에 어떻게 맞추는가다.

### 누가 부르나 — 세 갈래

| 갈래                                                                  | 비용을 내는 쪽                                       | adr-007과                                             | 자동화                   |
| --------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------- | ------------------------ |
| (a) 서비스(API 서버)가 이미지 API를 부른다                            | 서비스 운영자(= 지금은 사용자 본인, 2단계에선 우리)  | **충돌** — "서비스가 모델을 부르지 않는다"를 뒤집는다 | 됨                       |
| (b1) 사용자 쪽 에이전트가 **공식 Codex CLI**(ChatGPT 로그인)로 만든다 | 사용자 ChatGPT 구독(Codex 사용 한도 안, 추가 과금 0) | 맞음 — 서비스는 검사 · 저장만                         | 됨(`/blog-write` 안에서) |
| (b2) 사용자 쪽 에이전트가 사용자 **API 키**로 이미지 API를 부른다     | 사용자(API 과금)                                     | 맞음 — 서비스는 검사 · 저장만                         | 됨                       |
| (c) 사람이 ChatGPT · Gemini 앱(구독)에서 만들어 사진 자리에 올린다    | 사용자 구독(추가 비용 0)                             | 맞음                                                  | 안 됨(사람 손)           |

**구독으로 되는 공식 경로가 하나 있다: OpenAI Codex.** Codex는 ChatGPT Free · Go · Plus · Pro · Business · Edu · Enterprise 플랜에 들어 있다. 기본 제공 이미지 생성(`$imagegen` 스킬, 모델 `gpt-image-2`)은 **Codex 사용 한도 안에서** 돈다. 다만 같은 한도를 "평균 3~5배 빨리" 쓴다. API 키 없이 로그인만으로 된다. `OPENAI_API_KEY`를 주면 API 과금으로 바뀐다. `codex exec`(비대화형)는 저장된 CLI 로그인을 그대로 쓰고, 기본 샌드박스는 읽기 전용이다. 파일을 쓰려면 `--sandbox workspace-write`가 필요하다. Codex CLI는 MCP 클라이언트이기도 하다(`codex mcp`).

이 밖의 구독(Google AI Pro 등)으로는 서드파티 도구가 모델을 부르는 공식 경로를 찾지 못했다. Gemini CLI의 이미지 확장(nanobanana)은 결제가 연결된 API 키가 필요하다. 로그인 토큰을 뽑아 다른 도구에서 재사용하는 커뮤니티 브리지(`codex-bridge` · `codex-imagegen-cli` 등)는 약관상 회색이라 **쓰지 않는다**. 공식 `codex` 실행 파일을 직접 부르는 것만 쓴다.

### 후보 모델 (확인 2026-09-25)

| 후보                               | 장당 가격(USD)                                                                                | 상업 사용 · 저작권                                                     | 비고                                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Google Gemini 3.1 Flash Image      | 0.5K $0.045 · **1K $0.067** · 2K $0.101 (Batch 50% 할인)                                      | Google 생성형 AI 금지 사용 정책 안에서 사용                            | 비율 1:1 · 3:2 · 4:3 · 16:9 등, JPEG/PNG 출력, **모든 이미지에 SynthID**. 무료 등급 없음                  |
| Google Gemini 3.1 Flash Lite Image | 1K **$0.0336**                                                                                | 위와 같음                                                              | 1K만. 가장 싸다                                                                                           |
| Google Gemini 3 Pro Image          | 1K/2K $0.134                                                                                  | 위와 같음                                                              | 고품질 · 비쌈                                                                                             |
| OpenAI gpt-image-2                 | 1024×1536 · 1536×1024: low $0.005 · **medium $0.041** · high $0.165 / 1024×1024 medium $0.053 | 출력물 권리는 사용자에게 양도(이용약관). 동의 없는 실존 인물 초상 금지 | PNG/JPEG/WebP + 압축 설정. C2PA 메타데이터 · SynthID                                                      |
| Black Forest Labs FLUX.2           | klein $0.014~0.015 · **pro $0.03** · flex $0.05 · max $0.07 (첫 1MP 기준, 1 credit = $0.01)   | BFL API 약관                                                           | 가장 싼 축. 한국어 프롬프트 품질 미확인                                                                   |
| Ideogram 4.0                       | Turbo $0.03 · Default $0.06 · Quality $0.10 (제3자 집계)                                      | Ideogram 약관                                                          | 글자가 든 이미지에 강함. 공식 가격 페이지는 직접 확인하지 못함                                            |
| Imagen 4                           | Fast $0.02 · Standard $0.04 · Ultra $0.06 (제3자 집계)                                        | —                                                                      | Gemini API 공식 가격 페이지에 **더는 없다**. Vertex AI 전용이 된 것으로 보이며, 쓰려면 다시 확인해야 한다 |

- gpt-image-2 장당 가격은 OpenAI 가격 페이지가 토큰 단가(이미지 출력 $30/1M)만 싣고 장당 표는 가이드 계산기로 넘겨서, 계산기 값을 인용한 제3자 자료로 적었다.
- **아이 · 가족 이미지:** 모든 후보가 아동 성적 착취물을 금지한다. Gemini는 미성년자가 든 **이미지를 올려 편집**하는 것을 막는다(사용자 보고). 사실 사진풍으로 아이를 만들면 안전 필터에 막히거나 실존 인물처럼 보일 위험이 있다.
- **한국어 프롬프트:** 공식 문서로 확인하지 못했다. 그래서 주문서는 영어로 옮겨 보낸다(Claude가 한다).

### 표시 의무 · SEO

- **한국 인공지능기본법(2026-01-22 시행):** 표시 의무는 인공지능 **사업자**에게 있다. "단순히 인공지능 생성 결과물을 활용하여 자신의 콘텐츠를 제작 · 제공하는 경우"는 이용자로 본다(법무법인 세종 해설). 이 블로그는 의무 대상이 아니다.
- **EU AI Act 50조(2026-08-02 적용):** 실재처럼 보이는 딥페이크를 배포하는 쪽은 공개해야 한다. 사실 사진풍 인물 이미지는 여기에 걸릴 수 있다.
- **구글 검색:** 생성 이미지를 따로 불이익 주지 않는다. 다만 가치 없이 대량 생성하면 스팸 정책(scaled content abuse)에 걸릴 수 있다. IPTC `DigitalSourceType = TrainedAlgorithmicMedia` 메타데이터는 Merchant Center에서는 필수이고 일반 검색에서는 **지우지 말라는 권고**다.
- **우리 경로는 메타데이터를 지운다:** 브라우저 파이프라인은 캔버스로 다시 굽고, 서버는 저장만 한다. 그래서 C2PA · IPTC가 지워진다. SynthID는 픽셀에 박혀 남는다.

## 결정 (제안)

- **기본은 (b1)이다.** 이미지는 사용자 쪽 에이전트가 **공식 Codex CLI**로 만든다. 모델은 `gpt-image-2`이고, 비용은 ChatGPT 구독의 Codex 한도 안에서 나간다. 서비스(API 서버 · Lambda)는 여전히 어떤 모델도 부르지 않는다. 서비스는 받은 이미지를 adr-021 규칙대로 검사하고 저장만 한다. 돌리는 방법은 둘이다.
  - **Claude Code가 맡긴다:** Claude Code 세션(`/blog-write`)이 `codex exec --sandbox workspace-write -C <작업 폴더> '$imagegen <프롬프트>'`를 한 장씩 부르고, 만들어진 파일을 받아 다음 단계로 넘긴다.
  - **Codex에서 전부 돌린다:** Codex도 MCP 클라이언트라서 blog-editor MCP를 Codex에 연결하면(`codex mcp`) `/blog-write` 흐름 전체(리서치 · 글 · 이미지 · 꾸밈 · SEO)를 Codex에서 돌릴 수 있다. 스킬 파일은 두 도구가 같이 읽을 수 있게 둔다(#141에서 정한다).
- **예비는 (b2)다.** Codex 한도를 다 썼거나 대량으로 만들 때는 API 키 경로를 쓴다. 후보는 gpt-image-2 medium(가로 · 세로 $0.041)이나 Gemini 3.1 Flash Image 1K($0.067)다. 키는 세션 쪽 환경 변수에만 둔다.
- **최후는 (c)다.** 둘 다 안 되면 사진 자리(#136)를 남기고 사람이 채운다.
- **흐름:**
  1. AI가 쓴 사진 자리(#136)의 설명 글과 비율을 주문서로 쓴다.
  2. Claude가 영어 프롬프트로 옮기고 스타일 가이드(글쓰기 가이드의 이미지 구역)를 붙인다.
  3. 세션이 `codex exec … '$imagegen …'`을 부른다(예비는 API 키). `codex exec`에서 `$imagegen`이 도는지는 공식 문서에 명시돼 있지 않다. 커뮤니티 사용 예는 여럿 있다. 구현(#141) 첫 단계에서 로컬로 한 번 확인한다.
  4. macOS `sips -Z 1600 … -s format jpeg -s formatOptions 80`으로 긴 변 1600px · 1MiB 이하로 줄인다. `sips`는 WebP를 쓸 수 없으므로 JPEG로 한다.
  5. 서비스 이미지 API에 올린다. **연결 토큰으로 이미지 올리기를 허용하는 것은 후속 이슈**다. 지금 `/api/images`는 세션 쿠키 경로다.
  6. 사진 자리를 이미지 블록으로 바꾼다. 설명 글은 alt가 된다.
- **표시:** 법적 의무는 없어도 캡션에 "AI로 만든 그림"을 기본으로 단다. 신뢰도와 E-E-A-T 때문이다.
- **스타일 기본값:** 아이 · 가족이 나오는 장면은 **일러스트풍**을 기본으로 한다. 사실 사진풍은 딥페이크 표시 · 안전 필터 · 실존 인물 오인 위험이 있다.
- **예산 상한:** 세션 쪽 설정에 글 하나당 장 수 상한(기본 4장)을 둔다.
  - (b1)은 추가 과금이 없는 대신 Codex 한도를 빨리 쓴다. 코딩에 쓸 한도를 남기려면 장 수를 줄인다.
  - (b2)는 글 하나에 3장이면 약 $0.12~0.20, 한 달 20편이면 약 $2.5~4이다(아래 단가 기준).
- **구현은 이 ADR 밖이다.** `/blog-write`(#141) 안의 단계로 넣는다. 레포 `.env` · 서비스에는 로그인 정보나 키를 두지 않는다.

## 버린 대안

- **(a) 서비스가 이미지 API를 부른다:** 자동화는 가장 매끄럽다. 하지만 adr-007의 핵심("서비스가 모델을 부르지 않는다")을 뒤집는다. 서비스에 모델 키 · 요금 관리 · 남용 제한이 생기고, 2단계에서 외부 사용자의 생성 비용을 우리가 떠안거나 키를 받아야 한다. Lambda에서 수십 초 걸리는 생성은 타임아웃과 비용 문제도 있다.
- **(b2) API 키를 기본으로:** 한도 걱정이 없고 모델을 고를 수 있다. 하지만 구독과 별도로 요금이 나간다. Codex로 구독 안에서 되니 예비로만 둔다.
- **커뮤니티 브리지(로그인 토큰 재사용):** Claude Code 안에서 더 매끄럽다. 하지만 공식 클라이언트 밖에서 ChatGPT 로그인을 쓰는 것이라 약관상 회색이고, 토큰이 새면 계정 전체가 위험하다.
- **(c)만 쓴다(사람이 구독 앱에서 만들어 올린다):** 추가 비용은 0이다. 하지만 "알아서 넣는" 자동화가 안 된다. 사진 자리(#136)로 이미 되는 경로이므로 **최후 경로로 남긴다**.
- **무료 이미지 사이트(Unsplash · Pexels)만 쓴다:** 실사진이라 신뢰도는 좋다. 하지만 사용자가 고른 방향(사진 자리 · AI 생성)이 아니고, 글에 딱 맞는 장면을 찾기 어렵다. 나중에 소스로 더할 수 있다.
- **서버에서 줄이기(sharp):** adr-021에서 이미 버렸다. 세션 쪽 `sips`로 충분하다.
- **Imagen 4:** Gemini API 공식 가격표에서 빠져 있어 경로가 불확실하다.

## 감수한 트레이드오프

- **Codex 한도를 나눠 쓴다:** 이미지는 같은 한도를 평균 3~5배 빨리 쓴다. 이미지를 많이 만든 날은 Codex로 코딩할 여유가 줄어든다. 한도를 넘기면 (b2) API 과금이나 (c)로 떨어진다.
- **도구가 둘이 된다:** Claude Code로 쓰려면 Codex CLI 설치 · 로그인이 함께 필요하다. 모델은 `gpt-image-2` 하나로 고정된다(Gemini · FLUX는 API 키 경로에서만).
- **자동화가 로컬 에이전트(Claude Code · Codex)에 묶인다:** claude.ai 채팅 커넥터로 쓸 때는 AI가 이미지를 만들 수 없고 사진 자리만 남긴다.
- **`codex exec` + `$imagegen` 조합은 공식 문서로 확인되지 않았다:** 동작은 커뮤니티 자료 여러 건에 기댄다. 막히면 Codex 대화형이나 (b2)로 간다.
- **출처 메타데이터(C2PA · IPTC)가 지워진다:** 재인코딩 경로라서다. 표시는 캡션으로 하고, 메타데이터 보존은 서버가 원본을 그대로 저장하는 경로가 생기면 다시 본다.
- **한국어 프롬프트 품질을 확인하지 않았다:** 영어 번역을 한 단계 거친다.
- **가격은 자주 바뀐다:** 표는 2026-09-25 기준이다. 일부는 제3자 집계라 직접 확인이 필요하다(Ideogram · Imagen · gpt-image-2 장당 값).

## 재검토 조건

- 서비스가 외부 사용자에게 열릴 때(2단계): 사용자별 키를 받을지, 우리가 대납할지.
- OpenAI가 Codex 이미지 생성의 플랜 · 한도 · 약관을 바꿀 때.
- 다른 구독(Google AI Pro · Claude)에 공식 이미지 생성 CLI · 도구가 생길 때.
- 한 달 이미지 비용이 사용자가 정한 상한을 넘을 때.
- 구글이 생성 이미지 표시 · 메타데이터를 검색에서 필수로 바꿀 때.
- 선택한 모델이 가격표에서 빠지거나 지원이 끝날 때(예: Gemini 2.5 Flash Image는 2026-10-02 종료 예정).

## 정할 것 (사용자)

1. **어디서 돌릴까**
   - Claude Code가 `codex exec`로 이미지만 맡긴다 — 제안(글은 지금처럼 Claude가 쓴다)
   - Codex에서 `/blog-write` 전체를 돌린다(blog-editor MCP를 Codex에 연결)
   - 둘 다 되게 한다
2. **예비(API 키) 경로를 둘까, 모델은**
   - 두지 않는다 — Codex 한도가 끝나면 사진 자리로 남긴다
   - gpt-image-2 medium($0.041~0.053/장) — 제안
   - Gemini 3.1 Flash Image($0.067/장)
   - FLUX.2 pro($0.03/장)
3. **스타일 기본값**
   - 일러스트풍 — 제안
   - 사실 사진풍(인물 제외)
   - 글마다 AI가 고름
4. **"AI로 만든 그림" 캡션**
   - 늘 단다 — 제안
   - 달지 않는다
5. **예산 상한:** 글당 몇 장(Codex 한도를 얼마나 쓸지) · API 키면 한 달 얼마까지

## 출처 (확인 2026-09-25)

- Codex 이미지 생성(`$imagegen` · gpt-image-2 · 한도 3~5배 · API 키 전환): https://learn.chatgpt.com/docs/image-generation
- Codex 플랜 · 사용 한도: https://learn.chatgpt.com/docs/pricing
- Codex 비대화형(`codex exec` — 저장된 CLI 로그인 재사용 · 기본 읽기 전용 샌드박스): https://learn.chatgpt.com/docs/non-interactive-mode
- Codex CLI(MCP 서버 연결 `codex mcp`): https://learn.chatgpt.com/docs/codex/cli
- Codex CLI 이미지 생성 사용 예(커뮤니티, `codex exec` 예시 · 저장 위치 `~/.codex/generated_images/`): https://codex.danielvaughan.com/2026/04/27/codex-cli-image-generation-gpt-image-2-visual-development-workflows/
- Claude Code에서 `codex exec`로 이미지 맡기기(커뮤니티): https://paulkuo.tw/en/articles/claude-code-codex-imagegen/
- Gemini API 가격: https://ai.google.dev/gemini-api/docs/pricing
- Gemini 이미지 생성(비율 · 형식 · SynthID): https://ai.google.dev/gemini-api/docs/image-generation
- OpenAI 가격(토큰 단가): https://developers.openai.com/api/docs/pricing
- gpt-image-2 장당 값(계산기 인용): https://www.aifreeapi.com/en/posts/openai-image-generation-api-pricing
- OpenAI 이미지 가이드: https://developers.openai.com/api/docs/guides/image-generation
- OpenAI 출처 표시: https://help.openai.com/en/articles/8912793-c2pa-in-chatgpt-images
- OpenAI 약관: https://openai.com/policies/row-terms-of-use/
- BFL FLUX 가격: https://docs.bfl.ai/quick_start/pricing
- Ideogram(제3자): https://pricepertoken.com/ideogram-pricing
- Imagen 4(제3자): https://intuitionlabs.ai/articles/ai-image-generation-pricing-google-openai
- Gemini 이미지 · 책임 있는 AI: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/gemini-image-responsible-ai
- 구글 검색 생성형 AI 안내: https://developers.google.com/search/docs/fundamentals/using-gen-ai-content
- IPTC 메타데이터와 구글: https://iptc.org/news/google-announces-use-of-iptc-metadata-for-generative-ai-images/
- 인공지능기본법 시행(정책브리핑): https://www.korea.kr/news/policyNewsView.do?newsId=148958380
- 인공지능기본법 투명성 의무 해설(법무법인 세종): https://www.shinkim.com/kor/media/newsletter/3142
- EU AI Act 50조: https://artificialintelligenceact.eu/article/50/
- macOS `sips`(WebP 쓰기 불가): https://til.simonwillison.net/macos/sips
