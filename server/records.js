// 날짜별 시장 기록: 그날의 코스피 결과와 확정된 브리핑(범인, 소식, 숫자 발자국), 나중에 붙는 재판 결과.
// 시장 기록은 사용자마다 다르지 않으므로 서버에 하루 한 건만 둔다. 보물상자는 이 기록에서 조개를 꺼내 쓴다.
//
// 저장 위치
// - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 이 있으면 Upstash Redis (배포용, 사라지지 않음)
// - 없으면 파일: 프로젝트의 .cache/records (로컬 개발용). 서버리스에서는 임시 폴더라 재시작하면 사라진다.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const REDIS_KEY = 'petfolio:records'
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
export const isDay = (value) => typeof value === 'string' && DAY_PATTERN.test(value)

const redisConfig = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url: url.replace(/\/$/, ''), token } : null
}

async function redis(command) {
  const { url, token } = redisConfig()
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error(`Redis ${command[0]} failed: ${response.status}`)
  return (await response.json()).result
}

const FILE_DIRS = [path.join(process.cwd(), '.cache', 'records'), path.join(tmpdir(), 'petfolio-records')]
let fileDir = null

async function writableDir() {
  if (fileDir) return fileDir
  for (const dir of FILE_DIRS) {
    try {
      await mkdir(dir, { recursive: true })
      fileDir = dir
      return dir
    } catch { /* 못 쓰면 다음 위치 */ }
  }
  throw new Error('No writable records directory')
}

export async function getRecord(day) {
  if (!isDay(day)) return null
  if (redisConfig()) {
    const raw = await redis(['HGET', REDIS_KEY, day])
    return raw ? JSON.parse(raw) : null
  }
  try {
    return JSON.parse(await readFile(path.join(await writableDir(), `${day}.json`), 'utf8'))
  } catch {
    return null
  }
}

export async function putRecord(record) {
  if (!isDay(record?.day)) throw new Error('record.day must be YYYY-MM-DD')
  const data = { ...record, savedAt: new Date().toISOString() }
  if (redisConfig()) {
    await redis(['HSET', REDIS_KEY, record.day, JSON.stringify(data)])
  } else {
    await writeFile(path.join(await writableDir(), `${record.day}.json`), JSON.stringify(data, null, 1))
  }
  return data
}

// from ~ to (둘 다 포함) 사이의 기록을 날짜순으로.
export async function listRecords({ from = '0000-00-00', to = '9999-99-99' } = {}) {
  let records = []
  if (redisConfig()) {
    const flat = (await redis(['HGETALL', REDIS_KEY])) ?? []
    for (let index = 1; index < flat.length; index += 2) records.push(JSON.parse(flat[index]))
  } else {
    const dir = await writableDir()
    const files = (await readdir(dir)).filter((name) => isDay(name.replace(/\.json$/, '')))
    records = (await Promise.all(files.map((name) => readFile(path.join(dir, name), 'utf8').then(JSON.parse).catch(() => null))))
      .filter(Boolean)
  }
  return records.filter((record) => record.day >= from && record.day <= to).sort((a, b) => a.day.localeCompare(b.day))
}

// 보물상자에 필요한 만큼만: 조개 하나 = 기록 하나.
export function toShell(record) {
  const briefing = record.briefing ?? {}
  const culprit = briefing.culprit
  const firstSource = culprit?.sources?.[0] ?? briefing.items?.[0]?.sources?.[0] ?? null
  return {
    day: record.day,
    title: culprit?.title ?? '조용한 날',
    summary: culprit?.summary ?? briefing.quietMessage ?? '',
    chain: culprit?.chain ?? [],
    tag: culprit?.tag ?? null,
    confidence: culprit?.confidence ?? null,
    marketState: record.marketState,
    changeRate: record.changeRate,
    source: firstSource ? { name: firstSource.source, link: firstSource.link } : null,
    generatedAt: briefing.generatedAt ?? null,
    replayed: record.origin === 'replay',
    trial: record.trial ?? null,
  }
}
