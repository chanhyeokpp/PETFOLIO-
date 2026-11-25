// 지난 거래일 기록 채우기. 이미 있는 날은 건너뛴다(--force면 다시 만든다).
//   node --env-file=.env.local scripts/backfill.mjs 15
import { getRecord, putRecord } from '../server/records.js'
import { loadSeries, replayDay, tradingDays } from '../server/replay.js'

const count = Number(process.argv[2] ?? 10)
const force = process.argv.includes('--force')
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())

const series = await loadSeries()
// 오늘은 장이 끝나고 실제 브리핑이 확정되면 따로 남으므로 빼고, 그 전 거래일만
const days = tradingDays(series).filter((day) => day < today).slice(-count)
for (const day of days) {
  const existing = await getRecord(day)
  if (existing && !force) {
    console.log(`${day} 이미 있음 (${existing.origin})`)
    continue
  }
  try {
    const record = await replayDay(day, series)
    if (!record) {
      console.log(`${day} 기사 부족, 건너뜀`)
      continue
    }
    await putRecord({ ...record, trial: existing?.trial ?? null })
    const culprit = record.briefing.culprit
    console.log(`${day} 코스피 ${record.changeRate.toFixed(2)}% → ${culprit ? `${culprit.title} [${culprit.tag}/${culprit.confidence}]` : '안개'}`)
  } catch (error) {
    console.log(`${day} 실패: ${error.message}`)
  }
}
