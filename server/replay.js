// 지난 거래일을 다시 만든다: 그날까지의 시세와 그날 마감 기사 제목으로 범인을 뽑는다.
// 서버를 늦게 켰거나 기록이 비어 있는 날을 채울 때 쓴다. 그날의 투자자별 수급은 구할 수 없어 비워 둔다.
import { buildBriefing, CACHE_VERSION } from './briefing.js'
import { DRIVER_SYMBOLS, fetchDailyBars, summarizeBars, US_SESSION_SECONDS } from './drivers.js'
import { filterRelevant, parseFeed } from './news.js'

const MIN_HEADLINES = 5
export const kstDay = (seconds) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(seconds * 1000))
export const addDays = (day, count) => new Date(Date.parse(`${day}T00:00:00Z`) + count * 86_400_000).toISOString().slice(0, 10)

const NAVER_DAILY_URL = 'https://m.stock.naver.com/api/index/KOSPI/price'
const toNumber = (text) => Number(String(text ?? '').replaceAll(',', ''))

// 코스피 일별 종가와 등락률. Yahoo 일봉은 가끔 하루씩 빠져서 네이버 금융(비공식 JSON)을 쓴다.
async function fetchKospiDays(pages) {
  const days = []
  for (let page = 1; page <= pages; page += 1) {
    try {
      const response = await fetch(`${NAVER_DAILY_URL}?pageSize=60&page=${page}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000),
      })
      if (!response.ok) break
      const rows = await response.json()
      if (!Array.isArray(rows) || rows.length === 0) break
      for (const row of rows) {
        const close = toNumber(row.closePrice)
        const changeRate = toNumber(row.fluctuationsRatio)
        if (row.localTradedAt && Number.isFinite(close) && Number.isFinite(changeRate)) days.push({ day: row.localTradedAt, close, changeRate })
      }
    } catch {
      break
    }
  }
  return days.sort((a, b) => a.day.localeCompare(b.day))
}

// 한 번 받아 여러 날에 나눠 쓴다.
export async function loadSeries(range = '6mo') {
  const symbols = Object.fromEntries(Object.entries(DRIVER_SYMBOLS).map(([key, item]) => [key, item.symbol]))
  const [kospiDays, ...entries] = await Promise.all([
    fetchKospiDays(2),
    ...Object.entries(symbols).map(async ([key, symbol]) => [key, await fetchDailyBars(symbol, range)]),
  ])
  return { kospiDays, ...Object.fromEntries(entries) }
}

// 코스피가 열린 날들(오래된 순).
export const tradingDays = (series) => (series.kospiDays ?? []).map((item) => item.day)

export async function fetchDayHeadlines(day) {
  const query = `코스피 마감 after:${day} before:${addDays(day, 2)}`
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) })
    if (!response.ok) return []
    return filterRelevant(parseFeed(await response.text()), new Date(`${day}T20:00:00+09:00`))
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
  } catch {
    return []
  }
}

export function kospiOn(day, series) {
  const entry = (series.kospiDays ?? []).find((item) => item.day === day)
  if (!entry) return null
  const { changeRate } = entry
  const closeSeconds = Date.parse(`${day}T15:30:00+09:00`) / 1000
  const drivers = {}
  for (const [key, { label, group }] of Object.entries(DRIVER_SYMBOLS)) {
    const upTo = (series[key] ?? []).filter((item) => (group === 'us' ? item.time + US_SESSION_SECONDS <= closeSeconds : kstDay(item.time) <= day))
    const summary = summarizeBars(upTo)
    drivers[key] = summary ? { label, group, ...summary } : null
  }
  const marketState = Math.abs(changeRate) < 0.1 ? 'flat' : changeRate > 0 ? 'rise' : 'fall'
  return { changeRate, kospiValue: entry.close, marketState, investors: null, drivers }
}

// 기록 한 건을 만든다. 기사가 모자라면 null.
export async function replayDay(day, series) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY가 없어요')
  const kospi = kospiOn(day, series)
  if (!kospi) return null
  const headlines = await fetchDayHeadlines(day)
  if (headlines.length < MIN_HEADLINES) return null
  const briefing = await buildBriefing(apiKey, kospi, headlines)
  return {
    day,
    version: CACHE_VERSION,
    origin: 'replay',
    changeRate: kospi.changeRate,
    marketState: kospi.marketState,
    briefing: { ...briefing, generatedAt: `${day}T20:00:00+09:00` },
    trial: null,
  }
}
