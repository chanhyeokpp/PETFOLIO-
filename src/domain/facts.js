// 숫자로 확실히 말할 수 있는 것만 뽑는다: "무엇이 움직였나". "왜"는 여기서 말하지 않는다.
const UNUSUAL_MULTIPLE = 1.5
const CALM_MULTIPLE = 0.8

const signed = (value, digits = 2) => `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`

export const formatEok = (eok) => {
  const sign = eok > 0 ? '+' : eok < 0 ? '-' : ''
  const size = Math.abs(eok)
  return size >= 10_000 ? `${sign}${(size / 10_000).toFixed(1)}조` : `${sign}${Math.round(size).toLocaleString('ko-KR')}억`
}

const describeMultiple = (unusual) => {
  if (!Number.isFinite(unusual)) return null
  if (unusual >= UNUSUAL_MULTIPLE) return `평소의 ${unusual.toFixed(1)}배`
  return unusual < CALM_MULTIPLE ? '평소보다 잔잔' : '평소 수준'
}

export function buildFacts({ changeRate, flows, drivers }) {
  const facts = []
  if (Number.isFinite(changeRate)) facts.push({ key: 'kospi', label: '코스피', value: signed(changeRate), main: true })
  if (flows && Number.isFinite(flows.foreign)) {
    facts.push({ key: 'foreign', label: '외국인', value: `${formatEok(flows.foreign)} ${flows.foreign < 0 ? '순매도' : '순매수'}`.replace(/^[+-]/, '') })
  }
  if (!drivers) return facts
  // 미국 증시는 조용했더라도 알려준다: "미국 탓이 아니었다"도 정보다.
  if (drivers.nasdaq) {
    facts.push({ key: 'nasdaq', label: '간밤 나스닥', value: signed(drivers.nasdaq.changePercent), note: describeMultiple(drivers.nasdaq.unusual) })
  }
  for (const key of ['sox', 'usdkrw', 'samsung', 'hynix']) {
    const item = drivers[key]
    if (item && item.unusual >= UNUSUAL_MULTIPLE) {
      facts.push({ key, label: item.label, value: signed(item.changePercent), note: describeMultiple(item.unusual) })
    }
  }
  return facts
}
