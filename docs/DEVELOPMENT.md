# 개발 노트: 데이터 규칙과 장면 규칙

KOSPI 등락을 포리의 표정과 날씨로, KOSPI 거래대금을 배경의 물 높이로 보여주는 금융 학습용 웹 프로토타입입니다.

## 실행

```bash
npm install
npm run dev
```

## 데이터 연결

- KOSPI 지수와 등락률: Yahoo Finance 지연 데이터
- KOSPI 거래대금: KRX Open API의 `ACC_TRDVAL`. `KRX_AUTH_KEY`가 없으면 네이버 금융 값으로 대체
- 실제 거래대금을 사용하려면 실행 환경에 `KRX_AUTH_KEY`를 설정합니다.
- 키가 없거나 KRX 호출에 실패하면 거래대금은 실제값으로 표시하지 않고, 화면 아래 슬라이더로 물 높이를 시연합니다.

```bash
KRX_AUTH_KEY="발급받은_키" npm run dev
```

거래대금 20조원을 물 높이 100% 기준으로 삼고, 그 이상은 100%로 표시합니다. 기준값은 `server/kospi.js`의 `FULL_WATER_TRADING_VALUE`에서 바꿀 수 있습니다.

## 화면 규칙

- 수급(투자자별 순매수, 네이버 금융 비공식 JSON): 왼쪽 산호색 돛이 외국인, 오른쪽 파란 돛이 기관. 순매수면 포리 쪽으로 들어오며 짐이 늘고, 순매도면 뱃머리를 돌려 화면 밖으로 떠남. 1조원이면 최대
- 변동성(오늘 고가-저가 폭, Yahoo Finance): 파도 세기와 포리의 흔들림. 0.6% 이하는 잔잔, 3% 이상은 가장 거침. 거칠어지면(약 1.9% 이상) 포리가 튜브를 낌
- 휴장일(주말, 또는 평일인데 개장 시간이 지나도 당일 시세가 없는 공휴일): 밤 배경에서 포리가 자고 Zzz가 떠오름. 판정은 `server/kospi.js`의 `isMarketClosedDay`
- 거래대금 2조원: 발목 높이의 얕은 물
- 거래대금 12조원: 허리 높이, 포리가 뜨기 시작
- 거래대금 20조원 이상: 가장 깊은 물, 포리가 가슴까지 잠긴 채 떠 있음
- `prefers-reduced-motion` 환경에서는 물결과 포리의 반복 동작을 정지합니다.

## 기술 구성

- React + Vite
- three.js 3D 포리 (`src/Pori3D.jsx`): 상태별 자세, 터치 반응, 커서 따라보기, 3D 날씨(해·구름·비)
- 이전 Rive 2.5D 버전은 `src/PoriRive.jsx`와 `rive/`에 보관 (현재 화면에서는 사용하지 않음)
- 3D 물: 거래대금에 따라 수위가 변하고, 깊어지면 포리가 물 위에 뜸 (이전 CSS 물결은 `src/WaterBackground.jsx`에 보관)
- Vite 개발 서버 및 Vercel API 라우트

---

## Vite template notes

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## 화면 흐름

1. **시장 선택** (`src/screens/MarketSelect.jsx`): 좌우로 돌려 캐릭터를 고릅니다. 지금은 포리(국장)만 선택할 수 있고 미장·크립토는 준비 중입니다. 선택은 브라우저에 기억됩니다.
2. **오늘의 시황** (`src/screens/NewsBriefing.jsx`): 오늘의 범인 한 줄과 소식 카드. 그날 처음 들어올 때만 뜨고 건너뛸 수 있습니다. 실제 데이터일 때는 숫자로 확인되는 사실(`src/domain/facts.js`)과 언론사 마감 기사 제목(`server/news.js`, `/api/news`)을 보여줍니다. 원인 한 줄 요약은 아직 없습니다. 상태 테스트 모드나 기사를 못 받은 날에는 `src/domain/news.js`의 예시 데이터가 나오며 실제 기사가 아닙니다.
3. **포리 장면**: 상단의 "시장 바꾸기", "오늘 뉴스"로 앞 화면에 다시 갈 수 있습니다.

## 오늘의 범인 (LLM)

`server/briefing.js`가 그날 코스피 기사 제목(최대 60건)을 OpenAI에 보내 범인 한 줄, 인과 흐름, 소식 3~5개를 받습니다(`/api/briefing`). 범인은 기사에서 나오고, 숫자는 그 설명이 맞는지 검증만 합니다. 언론사 두 곳 이상이 말해야 범인으로 인정하며, 링크는 수집한 기사에서만 가져옵니다.

`.env.local`에 `OPENAI_API_KEY`가 있어야 동작합니다(`OPENAI_MODEL`로 모델 변경 가능, 기본 `gpt-5-mini`). 키가 없거나 휴장일이면 숫자 사실 요약과 기사 제목 목록으로 대신합니다. 장중에는 결과를 30분 동안 다시 쓰고, 한국 시간 16:30 이후에 만든 결과는 날짜별 기록(아래)으로 저장해 그날 내내 같은 내용을 보여줍니다. 다시 만들려면 그날의 기록 파일을 지우고, 프롬프트나 결과 형식을 바꿨다면 `server/briefing.js`의 `CACHE_VERSION`을 올립니다.

## 날짜별 기록, 보물상자, 일주일 뒤 재판

시장 기록은 사용자마다 같아서 서버에 하루 한 건만 둡니다(`server/records.js`). 기록에는 그날 코스피 결과, 확정된 브리핑(범인, 확신도, 숫자 발자국, 다른 용의자), 나중에 붙는 재판 결과가 들어갑니다.

- 저장 위치: `UPSTASH_REDIS_REST_URL`과 `UPSTASH_REDIS_REST_TOKEN`이 있으면 Upstash Redis, 없으면 `.cache/records/YYYY-MM-DD.json`. Vercel에서는 파일이 남지 않으므로 배포할 때는 Upstash 키가 필요합니다.
- 지난 거래일 채우기: `npm run backfill -- 20` (최근 20거래일 중 비어 있는 날만, `--force`면 다시 만듦). 그날까지의 시세와 그날 마감 기사 제목으로 범인을 다시 뽑습니다. 그날의 투자자별 수급은 구할 수 없어 비워 둡니다. 코스피 일별 등락은 네이버 금융, 미국 증시·환율·대장주는 Yahoo Finance.
- 보물상자(`/api/shells`): 처음 온 날의 일주일 전부터 기록을 조개로 보여줍니다. 들르지 않은 날 것도 들어 있고, 마지막으로 연 뒤에 생긴 조개에는 NEW가 붙습니다.
- 일주일 뒤 재판(`/api/trial?day=`): 그 뒤 거래일 기록이 5건 쌓이면 열 수 있습니다. 그 뒤 거래일 기록과 그 뒤 기사 제목을 LLM이 읽고 설명 유지 / 일부 수정 / 나중에 밝혀짐 / 판단 보류 중 하나로 판결합니다. 그 뒤에 새로 일어난 사건은 그날의 원인으로 치지 않고, 주가가 그 뒤 오르내린 것만으로는 판결하지 않습니다. 결과는 기록에 붙여 두고 다시 만들지 않습니다.

## 수평선 병편지 (다가오는 일정)

`server/letters.js`. 앞으로 21일 안의 일정이 병편지로 떠내려오고, 10일 안의 것(가까운 세 통)이 섬 북동쪽 바다에 병으로 뜹니다. 날짜가 가까울수록 섬 쪽으로 다가옵니다.

- 날짜는 공식 일정만 씁니다: 한국은행 금통위(한국은행 홈페이지), FOMC(연준), 미국 CPI(BLS), 수출(매월 1일 산업부, 1~20일은 21일 관세청, 주말이면 다음 월요일). **해마다 `CALENDAR`에 새해 일정을 넣어야 합니다.** 미국 발표는 한국 시장이 반영하는 다음 날로 적습니다.
- "무엇을 알게 되나"와 두 갈래 시나리오는 사람이 쓴 문장(`TEMPLATES`)입니다. 일반적인 관계만 말하고 방향을 예측하지 않습니다.
- "이번엔"(시장의 예상)은 최근 7일 기사 제목에서 LLM이 뽑습니다. 제목에 없으면 비웁니다. 3시간 동안 다시 씁니다.
- 일정이 지나면 그 뒤 첫 거래일 기록이 "답장"으로 붙습니다. 그날의 범인이 편지에 적힌 섬의 장소에서 나왔는지 보여줍니다.

## 섬이 점점 열린다

`src/domain/island.js`. 처음엔 포리, 물(거래대금), 파도(변동성), 외해 날씨(미국 증시), 보물상자만 있습니다. 나머지(물고기, 배, 고래, 등대 바람, 병편지)는 실제 시장에서 그것이 중요했던 날 처음 나타납니다. 예를 들어 외국인이 5천억 원 넘게 사고판 날 배가, 대장주가 3% 넘게 움직인 날 고래가 나타나고, 오늘의 범인이 나온 곳은 그날 바로 열립니다. 그런 날이 안 와도 2~6번째 방문 날에 하나씩 열리고, 하루에 두 가지까지만 엽니다. 새로 열린 것은 "섬에 새 친구가 왔어요" 카드로 소개합니다.

- 이 기능 전부터 기록이 있던 브라우저는 다 열린 상태로 시작합니다.
- `?island=new`: 처음 온 사람의 섬으로 봅니다(저장하지 않음).

## 장면에 보이는 원인

- **날씨 = 간밤 나스닥**: +0.5% 이상이면 맑음, -0.5% 이하면 비, 그 사이는 구름 조금. 지수가 내렸는데 맑으면 "미국 탓이 아닌 날"입니다. 휴장·로딩·오류 때는 상태에 따른 날씨(달, 점, 느낌표)가 나옵니다.
- **바람 = 원/달러 환율**: 환율이 오르면 왼쪽으로(외국인 배가 떠나는 방향), 내리면 오른쪽으로 붑니다. 하늘의 줄무늬와 배의 깃발로 보이며 하루 1% 변화에서 가장 셉니다.
- **고래 = 대장주**: 파란 고래는 삼성전자, 주황 고래는 SK하이닉스. 오르면 뛰어오르며 물을 뿜고, 내리면 고개를 숙이고 가라앉습니다. 하루 5% 변화에서 가장 큽니다.

- **물고기 = 오늘의 화제 종목**: 거래대금 상위 15개 보통주(삼성전자·SK하이닉스 제외) 가운데 가장 크게 움직인 3개. 모양은 같고 이름표만 바뀝니다. 오르면 뛰어오르고 내리면 물속으로 들어가며, 하루 10% 변화에서 가장 큽니다. 출처는 네이버 금융 비공식 JSON(`server/movers.js`).

값은 `/api/kospi`의 `drivers`와 `movers`에서 오고, 화면 아래 "시장을 움직인 원인" 슬라이더로 바꿔볼 수 있습니다.

장면의 날씨, 배 두 척, 고래 두 마리는 누를 수 있습니다. 누르면 말풍선 자리에 숫자, 장면에서의 의미, 관련 뉴스(LLM 브리핑이 있을 때)가 뜹니다. 누르는 영역은 `Pori3D`가 캔버스 위에 겹쳐 놓은 버튼이며 매 프레임 대상을 따라 움직입니다.

## 포리의 섬 (기본 장면)

`src/PoriIsland.jsx`. 바다에 떠 있는 작은 섬을 비스듬히 내려다보는 장면이며, 끌어서 돌려볼 수 있습니다. 예전 단면 장면은 주소에 `?scene=sea`를 붙이면 볼 수 있고, 섬 작업 전 상태는 git 태그 `before-island`에 저장돼 있습니다.

- **장소**: 등대(외해 = 간밤 미국 증시, 깃발 = 환율 바람), 선착장(외국인·기관 배), 물가(고래·물고기), 포리 집(조개 목걸이 자리, 준비 중)
- **포리가 가 있는 곳**: 실제 데이터일 때는 오늘의 범인 분류(수급 → 선착장, 미국 증시·환율 → 등대, 대장주·화제 종목 → 물가), 시연 중에는 가장 크게 움직인 원인. 휴장일은 집에서 잡니다.
- **물**: 거래대금이 많을수록 밀물이 들어와 모래사장이 잠기고, 변동성이 클수록 바깥 바다의 파도가 거세집니다.
