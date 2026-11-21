// 오늘의 화제 종목: 거래대금이 많은 종목 가운데 가장 크게 움직인 것들.
// "사람들이 실제로 많이 거래한 종목"만 보려고 거래대금 상위에서 고른다.
// 네이버 금융 모바일의 비공식 JSON이라 형식이 바뀌거나 막힐 수 있다.
const TOP_URL = 'https://m.stock.naver.com/api/stocks/priceTop/KOSPI?page=1&pageSize=60'
// 고래로 따로 보여주는 종목
const WHALE_CODES = new Set(['005930', '000660'])
// 거래대금 상위 몇 종목 안에서 고를지
const POOL_SIZE = 15
const MOVER_COUNT = 3

const toNumber = (text) => {
  const value = Number(String(text ?? '').replaceAll(',', ''))
  return Number.isFinite(value) ? value : null
}

export function pickMovers(stocks) {
  return stocks
    // 보통주만: ETF·ETN과 우선주(종목코드가 0으로 끝나지 않음)는 뺀다
    .filter((stock) => stock.stockEndType === 'stock' && /^\d{5}0$/.test(stock.itemCode) && !WHALE_CODES.has(stock.itemCode))
    .map((stock) => ({
      name: stock.stockName,
      code: stock.itemCode,
      changePercent: toNumber(stock.fluctuationsRatio),
      tradingValue: toNumber(stock.accumulatedTradingValue), // 백만원
    }))
    .filter((stock) => stock.name && stock.changePercent !== null && stock.tradingValue !== null)
    .sort((a, b) => b.tradingValue - a.tradingValue)
    .slice(0, POOL_SIZE)
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
    .slice(0, MOVER_COUNT)
}

// 구할 수 없으면 null.
export async function fetchMovers() {
  try {
    const response = await fetch(TOP_URL, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) })
    if (!response.ok) return null
    const movers = pickMovers((await response.json())?.stocks ?? [])
    return movers.length > 0 ? movers : null
  } catch {
    return null
  }
}
