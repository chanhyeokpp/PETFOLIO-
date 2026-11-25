// 증권사 시황 리포트 제목: 네이버 금융 리서치 '시황정보' 목록(비공식 JSON).
// 리포트 본문(PDF)은 증권사 저작물이라 가져오지 않는다. 제목, 증권사 이름, 링크만 쓴다.
// 제목에 원인이 적힌 것만 남긴다 ("Morning Brief(261120)"처럼 이름뿐인 제목은 뺀다).
const LIST_URL = 'https://m.stock.naver.com/api/research/market'
const PAGES = 3
const PAGE_SIZE = 40
const CACHE_MS = 30 * 60 * 1000

// 국내 시장 얘기가 아닌 것
const SKIP = /미국 주식시장|해외주식|Weekly|주간|Carbon|Defense|Japan|Global|글로벌|채권|크레딧|FX|원자재/i
// 제목 뒤쪽에 설명이 붙은 것만: "… - 설명", "[Market Time] 설명", "… ; 설명"
const DESCRIPTIVE = /\s-\s\S|\]\s*[^\s(]|;\s*\S/

let cache = null

async function fetchList() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows
  const rows = []
  for (let page = 1; page <= PAGES; page += 1) {
    try {
      const response = await fetch(`${LIST_URL}?page=${page}&pageSize=${PAGE_SIZE}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000),
      })
      if (!response.ok) break
      const list = await response.json()
      if (!Array.isArray(list) || list.length === 0) break
      rows.push(...list)
    } catch {
      break
    }
  }
  if (rows.length) cache = { at: Date.now(), rows }
  return rows
}

const pad = (value) => String(value).padStart(2, '0')

// 제목에 적힌 날짜: "(11월 24일)", "(26.11.24)"
function titleDay(title, writeDate) {
  const korean = title.match(/(\d{1,2})월\s*(\d{1,2})일/)
  if (korean) return `${writeDate.slice(0, 4)}-${pad(korean[1])}-${pad(korean[2])}`
  const dotted = title.match(/(\d{2})\.(\d{2})\.(\d{2})/)
  if (dotted) return `20${dotted[1]}-${dotted[2]}-${dotted[3]}`
  return null
}

const previousWeekday = (day) => {
  const date = new Date(`${day}T00:00:00Z`)
  do date.setUTCDate(date.getUTCDate() - 1)
  while ([0, 6].includes(date.getUTCDay()))
  return date.toISOString().slice(0, 10)
}

// 리포트가 어느 날 시장을 말하는지.
// 마감 시황·마켓레이더는 제목의 날짜(없으면 쓴 날), 아침 리포트는 그 전 거래일.
function subjectDay(row) {
  const stated = titleDay(row.title, row.writeDate)
  if (/마감|마켓레이더/.test(row.title)) return stated ?? row.writeDate
  return previousWeekday(row.writeDate)
}

// 제목에서 리포트 이름은 떼고 설명만: "국내 주식 마감 시황 - AI를 보증한… (11월 24일)" → "AI를 보증한…"
function cleanTitle(title) {
  let text = title
  if (/\s-\s/.test(text)) text = text.split(/\s-\s/).slice(1).join(' - ')
  else if (/\]/.test(text)) text = text.slice(text.indexOf(']') + 1)
  else if (/;/.test(text)) text = text.split(';').slice(1).join(';')
  return text.replace(/\((\d{1,2}월\s*\d{1,2}일|\d{2}\.\d{2}\.\d{2})\)/g, '').trim()
}

// day의 국내 시장을 말하는 증권사 리포트 (증권사당 하나).
export async function fetchBrokerReports(day) {
  const rows = await fetchList()
  const seen = new Set()
  return rows
    .filter((row) => row?.title && row.writeDate && !SKIP.test(row.title) && DESCRIPTIVE.test(row.title))
    .filter((row) => subjectDay(row) === day)
    // 설명에 한글이 두 글자 이상 있어야 원인이 적힌 제목으로 본다
    .filter((row) => (cleanTitle(row.title).match(/[가-힣]/g) ?? []).length >= 2)
    .filter((row) => {
      if (seen.has(row.brokerName)) return false
      seen.add(row.brokerName)
      return true
    })
    .map((row) => ({
      kind: 'broker',
      // closing: 그날 장 마감 시황 / morning: 다음 날 아침 리포트(간밤 미국 얘기가 섞인다)
      timing: /마감|마켓레이더/.test(row.title) ? 'closing' : 'morning',
      source: row.brokerName,
      title: cleanTitle(row.title),
      fullTitle: row.title,
      link: row.endUrl,
      publishedAt: `${row.writeDate}T16:00:00+09:00`,
    }))
}
