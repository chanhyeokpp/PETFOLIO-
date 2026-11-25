// 코스피를 움직이는 "원인" 후보들: 간밤 미국 증시, 환율, 대장주.
// Yahoo Finance 일봉 한 달치를 받아 오늘 변화율과 "평소 대비 얼마나 유난한지"를 계산한다.
const CHART_URL = 'https://query2.finance.yahoo.com/v8/finance/chart'
const DRIVER_SYMBOLS = {
  nasdaq: { symbol: '^IXIC', label: '나스닥', group: 'us' },
  sox: { symbol: '^SOX', label: '미국 반도체', group: 'us' },
  usdkrw: { symbol: 'KRW=X', label: '원/달러 환율', group: 'fx' },
  samsung: { symbol: '005930.KS', label: '삼성전자', group: 'leader' },
  hynix: { symbol: '000660.KS', label: 'SK하이닉스', group: 'leader' },
}
// 미국 정규장 길이. 일봉의 시각은 개장 시각이라 마감 시각을 구할 때 더한다.
const US_SESSION_SECONDS = 6.5 * 60 * 60
// "평소 움직임"을 재는 기간(거래일).
const TYPICAL_WINDOW_DAYS = 20

export async function fetchDailyBars(symbol) {
  try {
    const response = await fetch(`${CHART_URL}/${encodeURIComponent(symbol)}?range=2mo&interval=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0 petfolio-pm-day/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return null
    const result = (await response.json())?.chart?.result?.[0]
    const closes = result?.indicators?.quote?.[0]?.close
    const times = result?.timestamp
    if (!Array.isArray(closes) || !Array.isArray(times)) return null
    return times
      .map((time, index) => ({ time, close: closes[index] }))
      .filter((bar) => Number.isFinite(bar.close) && bar.close > 0)
  } catch {
    return null
  }
}

// bars 중 마지막 봉의 전일 대비 변화율과, 그 전 20일의 평균 변동 크기 대비 배수.
export function summarizeBars(bars) {
  if (!bars || bars.length < 3) return null
  const changes = []
  for (let index = 1; index < bars.length; index += 1) {
    changes.push((bars[index].close / bars[index - 1].close - 1) * 100)
  }
  const changePercent = changes.at(-1)
  const history = changes.slice(-1 - TYPICAL_WINDOW_DAYS, -1)
  const typicalMove = history.reduce((sum, value) => sum + Math.abs(value), 0) / history.length
  const last = bars.at(-1)
  return {
    price: last.close,
    changePercent,
    typicalMove,
    // 1이면 평소만큼, 3이면 평소의 세 배 움직인 날
    unusual: typicalMove > 0 ? Math.abs(changePercent) / typicalMove : null,
    time: new Date(last.time * 1000).toISOString(),
  }
}

// kospiTimeSeconds: 코스피 시세 시각. 미국 지수는 이 시각 전에 "끝난" 마지막 장만 본다.
// (한국 밤에 조회하면 진행 중인 미국 장이 섞이는데, 그건 오늘 코스피의 원인이 아니다.)
export async function fetchDrivers(kospiTimeSeconds) {
  const entries = await Promise.all(
    Object.entries(DRIVER_SYMBOLS).map(async ([key, { symbol, label, group }]) => {
      let bars = await fetchDailyBars(symbol)
      if (bars && group === 'us' && Number.isFinite(kospiTimeSeconds)) {
        bars = bars.filter((bar) => bar.time + US_SESSION_SECONDS <= kospiTimeSeconds)
      }
      const summary = summarizeBars(bars)
      return [key, summary ? { label, group, ...summary } : null]
    }),
  )
  return Object.fromEntries(entries)
}
