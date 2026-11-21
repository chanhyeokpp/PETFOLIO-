import { fetchDrivers } from './drivers.js'
import { fetchMovers } from './movers.js'

const KOSPI_URL =
  'https://query2.finance.yahoo.com/v8/finance/chart/%5EKS11?range=5d&interval=1d'
const KRX_KOSPI_URL = 'https://data-dbg.krx.co.kr/svc/apis/idx/kospi_dd_trd'
const FULL_WATER_TRADING_VALUE = 20_000_000_000_000
// 일중 변동폭(고가-저가)이 이 범위에서 파도 세기 0~1로 바뀐다. 코스피는 보통 1% 안팎.
const CALM_DAY_RANGE_PERCENT = 0.6
const ROUGH_DAY_RANGE_PERCENT = 3

// 네이버 금융 모바일의 비공식 JSON. 공식 API가 아니라서 형식이 바뀌거나 막힐 수 있다.
const NAVER_INDEX_URL = 'https://m.stock.naver.com/api/index/KOSPI'
// 순매수 금액이 이 크기(억원)면 배가 가장 가까이 오거나 가장 멀리 떠난다.
const FULL_FLOW_EOK = 10_000

async function fetchNaverJson(path) {
  try {
    const response = await fetch(`${NAVER_INDEX_URL}/${path}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(6000),
    })
    return response.ok ? await response.json() : null
  } catch {
    return null
  }
}

const parseSignedNumber = (text) => {
  const value = Number(String(text ?? '').replaceAll(',', '').replace('+', ''))
  return Number.isFinite(value) ? value : null
}

// 투자자별 순매수(억원). 구할 수 없으면 null.
async function fetchInvestorFlows() {
  const trend = await fetchNaverJson('trend')
  const foreign = parseSignedNumber(trend?.foreignValue)
  const institution = parseSignedNumber(trend?.institutionalValue)
  const individual = parseSignedNumber(trend?.personalValue)
  if (foreign === null || institution === null) return null
  return { foreign, institution, individual, date: trend.bizdate ?? null }
}

// 거래대금(원). KRX 키가 없을 때 쓰는 대체값.
async function fetchNaverTradingValue() {
  const integration = await fetchNaverJson('integration')
  const item = integration?.totalInfos?.find((info) => info.code === 'accumulatedTradingValue')
  const match = String(item?.value ?? '').match(/^([\d,]+)백만$/)
  if (!match) return null
  const millions = Number(match[1].replaceAll(',', ''))
  return Number.isFinite(millions) ? millions * 1_000_000 : null
}

const toFlowLevel = (eok) => Math.min(1, Math.max(-1, eok / FULL_FLOW_EOK))

function lastFinite(values) {
  if (!Array.isArray(values)) return null
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (Number.isFinite(values[index])) return values[index]
  }
  return null
}

// 오늘 고가와 저가의 차이를 중간값 대비 %로 본 값. 구할 수 없으면 null.
function getDayRangePercent(result) {
  const meta = result?.meta ?? {}
  const quote = result?.indicators?.quote?.[0]
  const high = Number.isFinite(meta.regularMarketDayHigh) ? meta.regularMarketDayHigh : lastFinite(quote?.high)
  const low = Number.isFinite(meta.regularMarketDayLow) ? meta.regularMarketDayLow : lastFinite(quote?.low)
  if (!Number.isFinite(high) || !Number.isFinite(low) || low <= 0 || high < low) return null
  return ((high - low) / ((high + low) / 2)) * 100
}

function toKrxDate(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
  return `${value.year}${value.month}${value.day}`
}

async function fetchKrxTradingValue(marketTime) {
  const authKey = process.env.KRX_AUTH_KEY
  if (!authKey) return null

  try {
    const date = toKrxDate(new Date(marketTime * 1000))
    const response = await fetch(`${KRX_KOSPI_URL}?basDd=${date}`, {
      headers: { AUTH_KEY: authKey },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return null

    const payload = await response.json()
    const kospi = payload?.OutBlock_1?.find((item) =>
      ['코스피', 'KOSPI'].includes(item.IDX_NM),
    )
    const tradingValue = Number(String(kospi?.ACC_TRDVAL ?? '').replaceAll(',', ''))
    return Number.isFinite(tradingValue) ? tradingValue : null
  } catch {
    return null
  }
}

// 휴장 판정: 주말이거나, 평일인데 개장 시간이 지나도록 오늘 날짜의 시세가 없으면(공휴일) 휴장.
// 장 마감 후 저녁은 휴장이 아니라 그날의 결과를 그대로 보여준다.
export function isMarketClosedDay(marketTimeSeconds, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(now).map(({ type, value }) => [type, value]),
  )
  if (parts.weekday === 'Sat' || parts.weekday === 'Sun') return true
  const minutes = Number(parts.hour) * 60 + Number(parts.minute)
  if (minutes < 9 * 60 + 40) return false
  return toKrxDate(new Date(marketTimeSeconds * 1000)) !== toKrxDate(now)
}

export async function fetchKospi() {
  const response = await fetch(KOSPI_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 petfolio-pm-day/1.0' },
    signal: AbortSignal.timeout(8000),
  })

  if (!response.ok) {
    throw new Error(`Market data request failed: ${response.status}`)
  }

  const payload = await response.json()
  const result = payload?.chart?.result?.[0]
  const meta = result?.meta

  if (!meta || !Number.isFinite(meta.regularMarketPrice)) {
    throw new Error('KOSPI market data is missing')
  }

  const changeRate = Number(meta.regularMarketChangePercent)
  const marketState = isMarketClosedDay(meta.regularMarketTime)
    ? 'closed'
    : changeRate > 0 ? 'rise' : changeRate < 0 ? 'fall' : 'flat'
  const [krxTradingValue, naverTradingValue, investors, drivers, movers] = await Promise.all([
    fetchKrxTradingValue(meta.regularMarketTime),
    fetchNaverTradingValue(),
    fetchInvestorFlows(),
    fetchDrivers(meta.regularMarketTime),
    fetchMovers(),
  ])
  // 대장주는 지수보다 얼마나 더 움직였는지도 함께 본다.
  for (const key of ['samsung', 'hynix']) {
    if (drivers[key] && Number.isFinite(changeRate)) {
      drivers[key].versusIndex = drivers[key].changePercent - changeRate
    }
  }
  const tradingValue = krxTradingValue ?? naverTradingValue
  const tradingActivity = tradingValue === null
    ? null
    : Math.min(1, Math.max(0.08, tradingValue / FULL_WATER_TRADING_VALUE))

  const dayRangePercent = getDayRangePercent(result)
  const volatility = dayRangePercent === null
    ? null
    : Math.min(1, Math.max(0, (dayRangePercent - CALM_DAY_RANGE_PERCENT) / (ROUGH_DAY_RANGE_PERCENT - CALM_DAY_RANGE_PERCENT)))

  return {
    symbol: meta.symbol,
    name: meta.longName ?? 'KOSPI Composite Index',
    kospiValue: Number(meta.regularMarketPrice),
    changeRate: Number.isFinite(changeRate) ? changeRate : 0,
    marketState,
    marketTime: new Date(meta.regularMarketTime * 1000).toISOString(),
    marketStatus: meta.marketState ?? 'CLOSED',
    dayRangePercent,
    volatility,
    tradingValue,
    tradingActivity,
    tradingValueSource: krxTradingValue !== null ? 'KRX' : naverTradingValue !== null ? 'Naver' : 'demo-required',
    investors,
    foreignFlow: investors ? toFlowLevel(investors.foreign) : null,
    institutionFlow: investors ? toFlowLevel(investors.institution) : null,
    drivers,
    movers,
    source: 'Yahoo Finance',
    delayed: true,
  }
}
