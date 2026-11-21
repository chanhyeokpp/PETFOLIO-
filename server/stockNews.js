// 종목 하나의 오늘 기사 제목. 낚시로 걸린 화제 종목의 소식을 보여줄 때 쓴다.
// 제목·언론사·링크만 다루고 본문은 가져오지 않는다. 출처는 구글 뉴스 검색 RSS(비상업적 이용 기준).
import { filterRelevant, parseFeed } from './news.js'

const CACHE_MS = 10 * 60 * 1000
const MAX_ITEMS = 3
const cache = new Map()

const searchUrl = (name) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(`"${name}" when:1d`)}&hl=ko&gl=KR&ceid=KR:ko`

export async function fetchStockNews(params) {
  const name = String(params?.get?.('name') ?? '').trim()
  // 종목 이름만 받는다 (검색어로 다른 걸 끼워 넣지 못하게)
  if (!name || name.length > 30 || !/^[0-9A-Za-z가-힣&.\- ]+$/.test(name)) {
    return { name, items: [], error: 'BAD_NAME' }
  }
  const hit = cache.get(name)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data
  let articles = []
  try {
    const response = await fetch(searchUrl(name), {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (response.ok) articles = parseFeed(await response.text())
  } catch {
    articles = []
  }
  // 주말·휴장일에도 직전 거래일 소식이 나오도록 '오늘'이 아니라 최근 72시간으로 거른다
  const items = filterRelevant(articles, new Date(), name, 72)
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    .slice(0, MAX_ITEMS)
  const data = { name, items, fetchedAt: new Date().toISOString() }
  cache.set(name, { at: Date.now(), data })
  return data
}
