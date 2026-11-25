// Which part of the scene a news item is about.
// `ready` = the scene already shows it, so the card can point at it.
export const SCENE_TAGS = {
  us: { label: '미국 증시', scene: '날씨', icon: '🌦️', ready: true },
  fx: { label: '환율', scene: '바람', icon: '🍃', ready: true },
  flow: { label: '수급', scene: '배', icon: '⛵', ready: true },
  leader: { label: '대장주', scene: '고래', icon: '🐋', ready: true },
  stock: { label: '화제 종목', scene: '물고기', icon: '🐟', ready: true },
  event: { label: '다가오는 일정', scene: '수평선 병편지', icon: '🍾', ready: true },
  other: { label: '그 밖의 소식', scene: null, icon: '📰', ready: false },
}

// 범인 맞히기의 보기. 섬의 장소로 묻는다. tags: 이 보기에 해당하는 범인 분류.
export const GUESS_CHOICES = [
  { key: 'weather', icon: '⛅', label: '외해 날씨', hint: '간밤 미국 증시', tags: ['us'] },
  { key: 'wind', icon: '🚩', label: '등대 바람', hint: '환율', tags: ['fx'] },
  { key: 'boats', icon: '⛵', label: '배', hint: '외국인·기관', tags: ['flow'] },
  { key: 'whales', icon: '🐋', label: '고래', hint: '삼성전자·SK하이닉스', tags: ['leader'] },
  { key: 'other', icon: '🐚', label: '섬 밖의 일', hint: '정책·소송·종목 소식', tags: ['stock', 'event', 'other'] },
]
export const guessChoiceFor = (tag) => GUESS_CHOICES.find((choice) => choice.tags.includes(tag)) ?? GUESS_CHOICES.at(-1)

// 범인 확신도. 몇 곳이 말했는지와 숫자가 뒷받침하는지로 서버가 정한다.
export const CONFIDENCE = {
  strong: { label: '유력', note: '여러 언론사가 말했고 숫자도 같은 쪽이에요' },
  likely: { label: '가능성 있음', note: '기사들은 이렇게 말하지만 단정하긴 일러요' },
  unclear: { label: '불확실', note: '단서는 있지만 숫자가 잘 맞지 않아요' },
}

export const SENTIMENTS = {
  good: '호재',
  bad: '악재',
  neutral: '중립',
}

// Hand-written sample briefings, one per market state. Not real articles:
// they stand in until the news pipeline (collect → pick → summarise) exists.
// culprit.chain is cause → path; the screen appends today's KOSPI result.
export const DEMO_NEWS = {
  rise: {
    culprit: {
      title: '간밤 미국 기술주 강세',
      tag: 'us',
      summary: '인공지능 투자 기대가 다시 커지며 간밤 미국 기술주가 강하게 올랐어요.',
      chain: ['미국 기술주 상승', '외국인 매수'],
      confidence: 'strong',
    },
    suspects: [{ title: '원/달러 환율 안정', tag: 'fx' }],
    footprints: [
      { tag: 'us', text: '간밤 미국 반도체 +2.80%', agrees: true, notable: true },
      { tag: 'fx', text: '원/달러 환율 -0.30%', agrees: true, notable: false },
      { tag: 'flow', text: '외국인 4,200억원 순매수', agrees: true, notable: true },
      { tag: 'leader', text: 'SK하이닉스 +3.10%', agrees: true, notable: true },
    ],
    items: [
      { id: 'rise-1', tag: 'us', sentiment: 'good', title: '미국 반도체주가 일제히 올랐어요', summary: '인공지능 투자 기대가 다시 커지며 간밤 미국 기술주가 강하게 올랐어요.' },
      { id: 'rise-2', tag: 'flow', sentiment: 'good', title: '외국인이 큰 폭으로 사들였어요', summary: '외국인이 반도체 대형주를 중심으로 순매수에 나섰어요.' },
      { id: 'rise-3', tag: 'leader', sentiment: 'good', title: '반도체 대장주가 지수를 끌어올렸어요', summary: '시가총액이 큰 두 종목이 함께 오르며 지수 상승의 대부분을 만들었어요.' },
      { id: 'rise-4', tag: 'fx', sentiment: 'neutral', title: '원/달러 환율은 소폭 내렸어요', summary: '환율이 안정되면서 외국인이 들어오기 편한 환경이 됐어요.' },
    ],
  },
  fall: {
    culprit: {
      title: '간밤 미국 반도체주 급락',
      tag: 'us',
      summary: '대형 반도체 기업의 실적 전망이 기대에 못 미치며 간밤 기술주가 급락했어요.',
      chain: ['미국 반도체주 급락', '외국인 매도'],
      confidence: 'likely',
    },
    suspects: [{ title: '달러 강세', tag: 'fx' }, { title: '외국인 차익 실현', tag: 'flow' }],
    footprints: [
      { tag: 'us', text: '간밤 미국 반도체 -3.40%', agrees: true, notable: true },
      { tag: 'fx', text: '원/달러 환율 +0.90%', agrees: true, notable: true },
      { tag: 'flow', text: '외국인 6,800억원 순매도', agrees: true, notable: true },
      { tag: 'leader', text: '삼성전자 -2.60%', agrees: true, notable: true },
    ],
    items: [
      { id: 'fall-1', tag: 'us', sentiment: 'bad', title: '미국 반도체주가 크게 빠졌어요', summary: '대형 반도체 기업의 실적 전망이 기대에 못 미치며 간밤 기술주가 급락했어요.' },
      { id: 'fall-2', tag: 'fx', sentiment: 'bad', title: '원/달러 환율이 뛰었어요', summary: '달러가 강해지면서 외국인에게는 한국 주식을 들고 있기 부담스러운 날이었어요.' },
      { id: 'fall-3', tag: 'flow', sentiment: 'bad', title: '외국인이 대규모로 팔았어요', summary: '외국인 매도 물량을 개인이 받아냈지만 지수 하락을 막지는 못했어요.' },
      { id: 'fall-4', tag: 'leader', sentiment: 'bad', title: '반도체 대장주가 지수를 끌어내렸어요', summary: '시가총액이 큰 두 종목이 함께 내리며 지수 하락폭을 키웠어요.' },
    ],
  },
  flat: {
    culprit: null,
    quietTitle: '오늘은 조용한 날이에요',
    quietMessage: '시장을 크게 움직인 원인이 없었어요. 이런 날은 다가오는 일정을 봐 두면 좋아요.',
    suspects: [{ title: '미국 물가 발표 대기', tag: 'event' }],
    footprints: [
      { tag: 'us', text: '간밤 나스닥 +0.10%', agrees: true, notable: false },
      { tag: 'fx', text: '원/달러 환율 +0.20%', agrees: false, notable: false },
      { tag: 'flow', text: '외국인 800억원 순매수', agrees: true, notable: false },
      { tag: 'leader', text: '삼성전자 -0.40%', agrees: false, notable: false },
    ],
    items: [
      { id: 'flat-1', tag: 'us', sentiment: 'neutral', title: '미국 증시는 제자리걸음이었어요', summary: '중요한 발표를 앞두고 간밤 미국 증시가 거의 움직이지 않았어요.' },
      { id: 'flat-2', tag: 'flow', sentiment: 'neutral', title: '외국인과 기관 모두 관망했어요', summary: '사는 쪽도 파는 쪽도 뚜렷하지 않아 거래가 한산했어요.' },
      { id: 'flat-3', tag: 'event', sentiment: 'neutral', title: '이번 주 미국 물가 발표가 있어요', summary: '결과에 따라 금리 전망이 바뀔 수 있어 시장이 기다리는 일정이에요.' },
    ],
  },
  closed: {
    culprit: null,
    quietTitle: '오늘은 장이 쉬어요',
    quietMessage: '한국 시장은 닫혀 있어요. 다음 장이 열리기 전에 알아둘 것만 모았어요.',
    items: [
      { id: 'closed-1', tag: 'us', sentiment: 'neutral', title: '쉬는 동안에도 미국 증시는 열려요', summary: '휴장 중 미국 증시의 움직임은 다음 개장일 아침에 한꺼번에 반영돼요.' },
      { id: 'closed-2', tag: 'event', sentiment: 'neutral', title: '다음 주 주요 일정을 확인해요', summary: '금리 결정이나 물가 발표처럼 시장이 기다리는 일정을 미리 봐 두면 좋아요.' },
    ],
  },
}
