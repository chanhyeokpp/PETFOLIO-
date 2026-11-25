import { useState } from 'react'
import { pageOf, SAMPLE_SHELLS, SHELL_PAGES, similarDays, sortShells } from './domain/shells'

const SHELL_COLORS = { rise: '#ff9f8f', fall: '#8fb8f5', flat: '#f3dcae' }
const RESULT_WORD = { rise: '올랐어요', fall: '내렸어요', flat: '보합이었어요' }

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

function ShellButton({ shell, active, onPick, showPage = false }) {
  return (
    <button
      type="button"
      className={`shell-item ${active ? 'on' : ''}`}
      onClick={() => onPick(shell.day)}
      aria-pressed={active}
    >
      <ShellIcon marketState={shell.marketState} />
      <small>{showPage && <span aria-hidden="true">{pageOf(shell).icon} </span>}{formatDay(shell.day)}</small>
      <span>{shell.title}</span>
    </button>
  )
}

// 포리의 보물상자: 날짜순으로 보거나, 범인이 있던 섬의 장소별(도감)로 본다.
// 조개를 누르면 그날 이야기와 "비슷했던 날"이 함께 나온다.
export default function ShellChest({ shells, onClose }) {
  const real = sortShells(shells)
  const isSample = real.length === 0
  const list = isSample ? SAMPLE_SHELLS : real
  const [view, setView] = useState('days')
  const [activeDay, setActiveDay] = useState(list[0]?.day ?? null)
  const active = list.find((shell) => shell.day === activeDay) ?? null
  const similar = active ? similarDays(active, list) : null
  const pages = SHELL_PAGES.map((page) => ({ ...page, shells: list.filter((shell) => pageOf(shell) === page) }))

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
      <div className="shell-tabs" role="tablist" aria-label="보는 방식">
        <button type="button" role="tab" aria-selected={view === 'days'} className={view === 'days' ? 'on' : ''} onClick={() => setView('days')}>날짜순</button>
        <button type="button" role="tab" aria-selected={view === 'pages'} className={view === 'pages' ? 'on' : ''} onClick={() => setView('pages')}>원인별 도감</button>
      </div>

      {view === 'days' ? (
        <ol className="shell-grid">
          {list.map((shell) => (
            <li key={shell.day}>
              <ShellButton shell={shell} active={shell.day === activeDay} onPick={setActiveDay} showPage />
            </li>
          ))}
        </ol>
      ) : (
        <div className="shell-pages">
          {pages.filter((page) => page.shells.length > 0).map((page) => (
            <section key={page.key} className="shell-page">
              <h3>
                <span aria-hidden="true">{page.icon}</span> {page.label}
                <small>{page.about}</small>
                <b>{page.shells.length}</b>
              </h3>
              <ol className="shell-grid">
                {page.shells.map((shell) => (
                  <li key={shell.day}>
                    <ShellButton shell={shell} active={shell.day === activeDay} onPick={setActiveDay} />
                  </li>
                ))}
              </ol>
            </section>
          ))}
          {pages.some((page) => page.shells.length === 0) && (
            <section className="shell-page missing">
              <h3>아직 못 찾은 조개</h3>
              <ul>
                {pages.filter((page) => page.shells.length === 0).map((page) => (
                  <li key={page.key} title={page.about}><span aria-hidden="true">{page.icon}</span> {page.label}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {active && (
        <div className="shell-detail">
          <small>
            {formatDay(active.day)} · {formatRate(active.changeRate)} · {pageOf(active).icon} {pageOf(active).label}
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
          {similar?.days.length > 0 && (
            <div className="shell-similar">
              <span>{similar.page.icon} {similar.page.label} 조개가 또 있어요</span>
              <ul>
                {similar.days.map((shell) => (
                  <li key={shell.day}>
                    <button type="button" onClick={() => setActiveDay(shell.day)}>
                      <ShellIcon marketState={shell.marketState} />
                      <span>{formatDay(shell.day)} {shell.title}</span>
                      <small>{RESULT_WORD[shell.marketState] ?? ''}</small>
                    </button>
                  </li>
                ))}
              </ul>
              {similar.different && (
                <p>같은 쪽에서 온 원인이어도 {formatDay(similar.different.day)}에는 시장이 {RESULT_WORD[similar.different.marketState]}. 원인이 비슷하다고 결과까지 같지는 않아요.</p>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
