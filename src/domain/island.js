// 섬이 점점 열린다: 처음엔 포리, 물(거래대금), 파도(변동성), 외해 날씨(미국 증시), 보물상자만 있고,
// 나머지는 실제 시장에서 그것이 중요했던 날 처음 나타난다. 그런 날이 안 오더라도 몇 번째 방문엔 나타난다.
// 한 번에 너무 많이 배우지 않도록 하루에 두 가지까지만 연다.

const VISITS_KEY = 'petfolio.visits'
const UNLOCKED_KEY = 'petfolio.unlocked'
const INTRODUCED_KEY = 'petfolio.introduced'
const PER_DAY = 2

const read = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}
const write = (key, value) => {
  try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* not remembered */ }
}

// latestVisit: 이 방문 날(서로 다른 날짜 기준 n번째)엔 시장과 상관없이 연다.
// tags: 오늘의 범인이 이 분류면 그날 연다.
export const ELEMENTS = [
  {
    key: 'fish', icon: '🐟', label: '이름표 물고기', pickKey: 'fish0', latestVisit: 2, tags: ['stock'],
    about: '오늘 거래가 많았던 종목 가운데 크게 움직인 녀석들이에요. 선착장 끝에서 낚아 올릴 수도 있어요.',
  },
  {
    key: 'boats', icon: '⛵', label: '배와 선원', pickKey: 'foreign', latestVisit: 3, tags: ['flow'],
    about: '바다사자 선장은 외국인, 정장 펭귄은 기관이에요. 많이 사면 짐을 싣고 들어오고, 팔면 등을 돌려 떠나요.',
  },
  {
    key: 'whales', icon: '🐋', label: '고래 두 마리', pickKey: 'samsung', latestVisit: 4, tags: ['leader'],
    about: '삼성전자와 SK하이닉스예요. 코스피에서 차지하는 몫이 커서, 둘이 움직이면 섬 전체가 출렁여요.',
  },
  {
    key: 'wind', icon: '🚩', label: '등대 바람', pickKey: 'lighthouse', latestVisit: 5, tags: ['fx'],
    about: '원/달러 환율이에요. 환율이 오르면 외국인 배를 밀어내는 쪽으로 바람이 불어요.',
  },
  {
    key: 'bottles', icon: '🍾', label: '수평선 병편지', pickKey: 'bottles', latestVisit: 6, tags: ['event'],
    about: '시장이 기다리는 일정이 며칠 전부터 떠내려와요. 무엇을 보게 되는지 미리 알려줘요.',
  },
]
export const ALL_KEYS = ELEMENTS.map((element) => element.key)
export const elementOf = (key) => ELEMENTS.find((element) => element.key === key)

// 받침이 있으면 이, 없으면 가 (영문·숫자로 끝나면 둘 다 보여준다)
const subject = (word) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (code < 0 || code > 11171) return `${word}이(가)`
  return `${word}${code % 28 ? '이' : '가'}`
}
const signed = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
const eok = (value) => (Math.abs(value) >= 10_000 ? `${(Math.abs(value) / 10_000).toFixed(1)}조` : `${Math.round(Math.abs(value)).toLocaleString('ko-KR')}억`)

// 오늘 시장에서 이 요소가 중요했다면 그 이유 한 문장. 아니면 null.
export function marketReason(key, market) {
  const { flows, drivers, movers, culpritTag, letters } = market
  const element = elementOf(key)
  if (culpritTag && element.tags.includes(culpritTag)) return '오늘의 범인이 바로 여기서 나왔어요.'
  if (key === 'boats' && Number.isFinite(flows?.foreign) && Math.abs(flows.foreign) >= 5000) {
    return `오늘 외국인이 ${eok(flows.foreign)} 원어치를 ${flows.foreign < 0 ? '팔았어요' : '샀어요'}.`
  }
  if (key === 'whales') {
    const leader = [drivers?.samsung, drivers?.hynix].filter(Boolean)
      .reduce((best, item) => (!best || Math.abs(item.changePercent) > Math.abs(best.changePercent) ? item : best), null)
    if (leader && Math.abs(leader.changePercent) >= 3) return `오늘 ${subject(leader.label)} ${signed(leader.changePercent)} 움직였어요.`
  }
  if (key === 'wind' && drivers?.usdkrw && drivers.usdkrw.unusual >= 1.5) {
    return `오늘 원/달러 환율이 평소의 ${drivers.usdkrw.unusual.toFixed(1)}배만큼 움직였어요.`
  }
  if (key === 'fish') {
    const mover = (movers ?? []).find((item) => Math.abs(item.changePercent) >= 10)
    if (mover) return `오늘 ${subject(mover.name)} ${signed(mover.changePercent)} 움직였어요.`
  }
  if (key === 'bottles') {
    const soon = (letters ?? []).find((letter) => letter.dday <= 1)
    if (soon) return `${soon.dday === 0 ? '오늘' : '내일'} ${soon.title} 일정이 있어요.`
  }
  return null
}

// 방문 기록. 이미 쓰던 사용자(이 기능 전부터 기록이 있던 브라우저)는 섬을 다 연 상태로 시작한다.
// preview: 'new' = 처음 온 사람의 섬, 'all' = 다 열린 섬 (발표용). 둘 다 저장하지 않는다.
export function startIsland(today, { preview = null } = {}) {
  if (preview === 'new') return { visits: [today], unlocked: {}, introduced: [], preview: true }
  if (preview === 'all') {
    return {
      visits: [today],
      unlocked: Object.fromEntries(ALL_KEYS.map((key) => [key, { day: today, reason: null }])),
      introduced: [...ALL_KEYS],
      preview: true,
    }
  }
  let visits = read(VISITS_KEY, null)
  let unlocked = read(UNLOCKED_KEY, null)
  let introduced = read(INTRODUCED_KEY, [])
  if (visits === null) {
    let existing = false
    try {
      existing = Boolean(window.localStorage.getItem('petfolio.newsSeen') || window.localStorage.getItem('petfolio.shells'))
    } catch { /* treat as new */ }
    visits = []
    if (existing) {
      unlocked = Object.fromEntries(ALL_KEYS.map((key) => [key, { day: today, reason: null }]))
      introduced = [...ALL_KEYS]
    }
  }
  if (!visits.includes(today)) visits = [...visits, today].slice(-60)
  write(VISITS_KEY, visits)
  write(UNLOCKED_KEY, unlocked ?? {})
  write(INTRODUCED_KEY, introduced)
  return { visits, unlocked: unlocked ?? {}, introduced, preview: false }
}

// 오늘 열린 상태: 이미 연 것 + 오늘 새로 열 것(하루 두 가지까지). 시장 이유가 있는 것을 먼저.
export function resolveIsland(start, today, market) {
  const unlocked = { ...start.unlocked }
  let openedToday = Object.values(unlocked).filter((item) => item.day === today).length
  const visitNumber = start.visits.length
  const candidates = ELEMENTS
    .filter((element) => !unlocked[element.key])
    .map((element) => {
      const reason = market ? marketReason(element.key, market) : null
      const due = visitNumber >= element.latestVisit
      return { element, reason: reason ?? (due ? `섬에 온 지 ${visitNumber}번째 날이라 새 친구가 찾아왔어요.` : null), fromMarket: Boolean(reason) }
    })
    .filter((item) => item.reason)
    .sort((a, b) => Number(b.fromMarket) - Number(a.fromMarket))
  for (const item of candidates) {
    if (openedToday >= PER_DAY) break
    unlocked[item.element.key] = { day: today, reason: item.reason }
    openedToday += 1
  }
  return unlocked
}

export function saveIsland(start, unlocked, introduced) {
  if (start.preview) return
  write(UNLOCKED_KEY, unlocked)
  write(INTRODUCED_KEY, introduced)
}
