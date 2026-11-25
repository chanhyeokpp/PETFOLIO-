// Pori's treasure chest: one shell per trading day, made from that day's "culprit".
// Shells live in this browser only for now (no accounts yet), so clearing site data empties the chest.

const STORAGE_KEY = 'petfolio.shells'
const SEEN_KEY = 'petfolio.shellsSeen'

const read = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}
const write = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch { /* the chest just won't remember */ }
}

export const readShells = () => read(STORAGE_KEY, {})
export const readSeenDay = () => read(SEEN_KEY, null)
export const markShellsSeen = (day) => write(SEEN_KEY, day)

// Turn today's briefing into a shell. Quiet days get a plain shell too: "nothing big happened" is a record.
export function shellFromBriefing(day, briefing, changeRate, marketState) {
  const culprit = briefing.culprit
  const firstSource = culprit?.sources?.[0] ?? briefing.items?.[0]?.sources?.[0] ?? null
  return {
    day,
    title: culprit?.title ?? '조용한 날',
    summary: culprit?.summary ?? briefing.quietMessage ?? '',
    chain: culprit?.chain ?? [],
    tag: culprit?.tag ?? null,
    confidence: culprit?.confidence ?? null,
    marketState,
    changeRate,
    source: firstSource ? { name: firstSource.source, link: firstSource.link } : null,
    generatedAt: briefing.generatedAt,
  }
}

export function saveShell(shell) {
  const shells = readShells()
  shells[shell.day] = shell
  write(STORAGE_KEY, shells)
  return shells
}

// Newest first.
export const sortShells = (shells) => Object.values(shells).sort((a, b) => b.day.localeCompare(a.day))

// 도감의 쪽: 범인이 있던 섬의 장소. 범인이 없던 날은 안개.
export const SHELL_PAGES = [
  { key: 'weather', icon: '⛅', label: '외해 날씨', about: '간밤 미국 증시', tags: ['us'] },
  { key: 'wind', icon: '🚩', label: '등대 바람', about: '환율', tags: ['fx'] },
  { key: 'boats', icon: '⛵', label: '배', about: '외국인·기관', tags: ['flow'] },
  { key: 'whales', icon: '🐋', label: '고래', about: '삼성전자·SK하이닉스', tags: ['leader'] },
  { key: 'other', icon: '🐚', label: '섬 밖의 일', about: '정책·소송·종목 소식', tags: ['stock', 'event', 'other'] },
  { key: 'fog', icon: '🌫️', label: '안개', about: '뚜렷한 범인이 없던 날', tags: [null] },
]
export const pageOf = (shell) => SHELL_PAGES.find((page) => page.tags.includes(shell.tag ?? null)) ?? SHELL_PAGES[4]

// 비슷했던 날: 같은 쪽의 다른 날들. 결과가 달랐던 날이 있으면 꼭 하나 넣는다
// ("원인이 같으면 결과도 같다"고 배우지 않도록).
export function similarDays(shell, list, limit = 3) {
  const page = pageOf(shell)
  const others = list.filter((item) => item.day !== shell.day && pageOf(item) === page)
  const different = others.find((item) => item.marketState !== shell.marketState)
  const picked = others.filter((item) => item !== different).slice(0, different ? limit - 1 : limit)
  return { page, days: different ? [...picked, different] : picked, different }
}

// Shown only while the chest is still empty. These are results our own pipeline produced when
// replaying past trading days, kept as examples; they are labelled as examples on screen.
export const SAMPLE_SHELLS = [
  {
    day: '2026-11-16', title: '엔비디아 불확실성', marketState: 'fall', changeRate: -3.59, tag: 'us',
    summary: "'AI 빅위크'를 앞두고 엔비디아 관련 불확실성이 커지며 반도체 중심으로 투자심리가 위축됐어요.",
    chain: ['AI 투자심리 위축', '외국인 대규모 매도', '반도체주 낙폭 확대'], source: null,
  },
  {
    day: '2026-11-13', title: '젠슨 황 쇼크', marketState: 'fall', changeRate: -0.98, tag: 'us',
    summary: '젠슨 황 관련 소식에 엔비디아 불확실성이 커지며 국내 반도체가 약세를 보였어요.',
    chain: ['젠슨 황 충격', '엔비디아 불확실', '반도체·외국인 매도'], source: null,
  },
  {
    day: '2026-11-12', title: '젠슨 황 해임설', marketState: 'fall', changeRate: -0.61, tag: 'us',
    summary: '젠슨 황 해임설이 불거지며 투자심리가 위축됐어요.',
    chain: ['젠슨 황 해임설', '엔비디아 리스크', '반도체주 약세'], source: null,
  },
  {
    day: '2026-11-11', title: 'AI 투자 우려 완화', marketState: 'rise', changeRate: 2.6, tag: 'stock',
    summary: 'AI 인프라 투자 우려가 누그러지며 반도체주가 회복했어요.',
    chain: ['AI 투자 우려 완화', '반도체주 강세', '외국인 순매수'], source: null,
  },
  {
    day: '2026-11-10', title: '미국 증시 훈풍', marketState: 'rise', changeRate: 4.39, tag: 'us',
    summary: '미국 증시 강세 흐름이 코스피 반등을 이끌었어요.',
    chain: ['미국 증시 강세', '외국인·저가 매수'], source: null,
  },
]
