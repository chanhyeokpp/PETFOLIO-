// 코스피 마감 기사 제목 수집. 제목·언론사·링크·시각만 다루고 본문은 가져오지 않는다.
// 출처는 공개 RSS지만 개인적·비상업적 이용이 기본이라, 서비스로 낼 때는 약관 확인이 필요하다.
const FEEDS = [
  {
    // 여러 언론사의 마감 기사가 한 번에 모인다. 제목 끝에 " - 언론사"가 붙어 온다.
    url: 'https://news.google.com/rss/search?q=%EC%BD%94%EC%8A%A4%ED%94%BC+%EB%A7%88%EA%B0%90+when:1d&hl=ko&gl=KR&ceid=KR:ko',
    fallbackSource: null,
  },
  { url: 'https://www.yna.co.kr/rss/market.xml', fallbackSource: '연합뉴스' },
]
const MAX_PICKS = 5
const CACHE_MS = 10 * 60 * 1000
// 제목에 "왜"가 들어 있을 가능성이 높은 표현. LLM을 붙이기 전까지 쓰는 임시 기준이다.
const CAUSE_HINT = /팔자|사자|매도|매수|여파|우려|충격|쇼크|파장|여진|소송|훈풍|기대|덕분|탓|투매|발언/
const CLOSING_MINUTES_KST = 15 * 60 + 30
const BLOG_SOURCE = /blog|블로그|tistory|티스토리|brunch|브런치|카페|cafe/i

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
const decodeEntities = (text) => text
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match)

function readField(item, name) {
  const match = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))
  if (!match) return ''
  const text = match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  return decodeEntities(decodeEntities(text).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
}

export function parseFeed(xml, fallbackSource = null) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
    let source = readField(item, 'source') || fallbackSource || ''
    let title = readField(item, 'title')
    // "제목 - 언론사" 꼬리표 제거 (가끔 두 번 붙는다)
    while (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3)).trim()
    title = title.replace(/\s+By\s+\S+$/, '')
    // 언론사 이름 대신 주소가 오는 경우가 있다
    if (/^https?:\/\//.test(source)) {
      try { source = new URL(source).hostname.replace(/^www\./, '') } catch { source = '' }
    }
    const publishedAt = new Date(readField(item, 'pubDate'))
    const link = readField(item, 'link')
    source = source.replace(/^www\./, '')
    return {
      title,
      source,
      link: /^https?:\/\//.test(link) ? link : null,
      publishedAt: Number.isNaN(publishedAt.getTime()) ? null : publishedAt.toISOString(),
    }
  }).filter((article) => article.title && article.link)
}

const kstParts = (date) => Object.fromEntries(
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(({ type, value }) => [type, value]),
)
const kstDay = (date) => { const p = kstParts(date); return `${p.year}-${p.month}-${p.day}` }
const kstMinutes = (date) => { const p = kstParts(date); return Number(p.hour) * 60 + Number(p.minute) }

function scoreArticle(article) {
  let score = 0
  if (CAUSE_HINT.test(article.title)) score += 3
  if (article.title.includes('마감')) score += 1
  if (article.publishedAt && kstMinutes(new Date(article.publishedAt)) >= CLOSING_MINUTES_KST) score += 2
  if (article.title.includes('[속보]')) score -= 2
  return score
}

// 오늘(한국 날짜) 나온 코스피 기사만, 같은 제목은 하나로.
// keyword: 제목에 꼭 들어가야 하는 말. withinHours를 주면 '오늘(한국 날짜)' 대신 최근 몇 시간으로 거른다.
export function filterRelevant(articles, now = new Date(), keyword = '코스피', withinHours = null) {
  const today = kstDay(now)
  const seen = new Set()
  return articles.filter((article) => {
    if (!article.title.includes(keyword) || article.title.startsWith('[표]')) return false
    // 블로그·카페 글은 언론사가 아니다
    if (BLOG_SOURCE.test(article.source ?? '') || BLOG_SOURCE.test(article.title)) return false
    if (!article.publishedAt) return false
    const published = new Date(article.publishedAt)
    if (withinHours === null ? kstDay(published) !== today : now - published > withinHours * 3600 * 1000) return false
    const key = article.title.replace(/[^0-9a-zA-Z가-힣]/g, '')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// 원인이 담긴 마감 기사를 언론사당 하나씩 고른다.
export function pickArticles(articles, now = new Date()) {
  const relevant = filterRelevant(articles, now)
  const ranked = relevant
    .map((article) => ({ article, score: scoreArticle(article) }))
    .sort((a, b) => b.score - a.score || (b.article.publishedAt ?? '').localeCompare(a.article.publishedAt ?? ''))
  const outlets = new Set()
  const picks = []
  for (const { article } of ranked) {
    if (outlets.has(article.source)) continue
    outlets.add(article.source)
    picks.push(article)
    if (picks.length === MAX_PICKS) break
  }
  return {
    items: picks,
    collectedCount: relevant.length,
    outletCount: new Set(relevant.map((article) => article.source)).size,
  }
}

async function fetchFeed({ url, fallbackSource }) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    })
    return response.ok ? parseFeed(await response.text(), fallbackSource) : []
  } catch {
    return []
  }
}

let cache = null

async function fetchArticles() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.articles
  const articles = (await Promise.all(FEEDS.map(fetchFeed))).flat()
  if (articles.length > 0) cache = { at: Date.now(), articles }
  return articles
}

export async function fetchNews() {
  return { ...pickArticles(await fetchArticles()), fetchedAt: new Date().toISOString() }
}

// 범인 뽑기에 쓰는 오늘의 코스피 기사 제목 전체. 마감 뒤 기사가 앞에 오도록 최신순.
export async function collectHeadlines() {
  return filterRelevant(await fetchArticles())
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
}
