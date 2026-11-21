import { useState } from 'react'
import { SAMPLE_SHELLS, sortShells } from './domain/shells'

const SHELL_COLORS = { rise: '#ff9f8f', fall: '#8fb8f5', flat: '#f3dcae' }

// A little scallop shell; the colour says whether the market rose or fell that day.
function ShellIcon({ marketState }) {
  const fill = SHELL_COLORS[marketState] ?? SHELL_COLORS.flat
  return (
    <svg className="shell-icon" viewBox="0 0 48 44" aria-hidden="true">
      <path d="M24 40 L6 18 Q4 6 24 4 Q44 6 42 18 Z" fill={fill} />
      <path d="M24 40 L14 8 M24 40 L24 4 M24 40 L34 8 M24 40 L8 14 M24 40 L40 14" stroke="rgba(255,255,255,.75)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M17 40 h14 v3 h-14 z" fill={fill} />
    </svg>
  )
}

const formatDay = (day) => {
  const [, month, date] = day.split('-')
  return `${Number(month)}/${Number(date)}`
}
const formatRate = (rate) => (Number.isFinite(rate) ? `코스피 ${rate > 0 ? '+' : ''}${rate.toFixed(2)}%` : '')

export default function ShellChest({ shells, onClose }) {
  const real = sortShells(shells)
  const isSample = real.length === 0
  const list = isSample ? SAMPLE_SHELLS : real
  const [activeDay, setActiveDay] = useState(list[0]?.day ?? null)
  const active = list.find((shell) => shell.day === activeDay) ?? null

  return (
    <aside className="shell-chest" aria-label="포리의 보물상자">
      <header>
        <strong>포리의 보물상자</strong>
        <span>조개 {list.length}개</span>
        <button type="button" onClick={onClose} aria-label="보물상자 닫기">✕</button>
      </header>
      <p className="shell-note">
        {isSample
          ? '아직 모은 조개가 없어서 예시 조개를 보여드려요. 장이 열린 날 들르면 포리가 그날의 조개를 주워 와요.'
          : '장이 열린 날마다 포리가 그날 시장을 움직인 이야기를 조개로 주워 와요.'}
      </p>
      <ol className="shell-grid">
        {list.map((shell) => (
          <li key={shell.day}>
            <button
              type="button"
              className={`shell-item ${shell.day === activeDay ? 'on' : ''}`}
              onClick={() => setActiveDay(shell.day)}
              aria-pressed={shell.day === activeDay}
            >
              <ShellIcon marketState={shell.marketState} />
              <small>{formatDay(shell.day)}</small>
              <span>{shell.title}</span>
            </button>
          </li>
        ))}
      </ol>
      {active && (
        <div className="shell-detail">
          <small>
            {formatDay(active.day)} · {formatRate(active.changeRate)}
            {isSample && <em> · 예시</em>}
          </small>
          <strong>{active.title}</strong>
          {active.summary && <p>{active.summary}</p>}
          {active.chain?.length > 0 && <p className="shell-chain">{active.chain.join(' → ')}</p>}
          {active.source?.link && (
            <a href={active.source.link} target="_blank" rel="noopener noreferrer">
              출처: {active.source.name || '기사 보기'}
            </a>
          )}
        </div>
      )}
    </aside>
  )
}
