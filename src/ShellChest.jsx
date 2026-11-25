import { useEffect, useState } from 'react'
import { pageOf, SAMPLE_SHELLS, SHELL_PAGES, similarDays, sortShells, VERDICTS } from './domain/shells'

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

const signed = (rate) => `${rate > 0 ? '+' : ''}${rate.toFixed(2)}%`

function ShellButton({ shell, active, onPick, showPage = false, fresh = false, trial = null }) {
  const verdict = trial ? VERDICTS[trial.verdict] : null
  return (
    <button
      type="button"
      className={`shell-item ${active ? 'on' : ''} ${fresh ? 'fresh' : ''}`}
      onClick={() => onPick(shell.day)}
      aria-pressed={active}
    >
      {fresh && <em className="shell-badge fresh">NEW</em>}
      {!fresh && verdict && <em className="shell-badge" title={verdict.label}>{verdict.icon}</em>}
      {!fresh && !verdict && shell.status === 'ready' && <em className="shell-badge" title="재판을 열 수 있어요">⚖️</em>}
      <ShellIcon marketState={shell.marketState} />
      <small>{showPage && <span aria-hidden="true">{pageOf(shell).icon} </span>}{formatDay(shell.day)}</small>
      <span>{shell.title}</span>
    </button>
  )
}

const BROKER_STAMPS = {
  same: { label: '증권사도 같은 원인', tone: 'same' },
  partly: { label: '증권사는 일부만 같게 봄', tone: 'partly' },
  different: { label: '증권사는 다르게 봄', tone: 'different' },
}

// 증권사 확인 도장: 다음 날 아침까지 나온 증권사 시황 리포트 제목과 그날의 범인을 견준 결과.
function BrokerStamp({ check }) {
  if (!check) return null
  if (check === 'loading') return <p className="broker-stamp waiting">증권사 시황 리포트와 견주는 중이에요…</p>
  if (check.status === 'waiting') return <p className="broker-stamp waiting">증권사 시황 리포트가 아직 모이지 않았어요. 다음 날 아침쯤 확인 도장이 찍혀요.</p>
  const result = check.brokerCheck
  if (!result) return null
  const stamp = BROKER_STAMPS[result.stamp] ?? BROKER_STAMPS.partly
  return (
    <div className={`broker-stamp ${stamp.tone}`}>
      <span className="broker-mark">{stamp.label}</span>
      <p>{result.note}</p>
      <small>
        {result.reports.map((report, index) => (
          <span key={report.link}>
            {index > 0 && ' · '}
            <a href={report.link} target="_blank" rel="noopener noreferrer" title={report.title}>{report.source}</a>
          </span>
        ))}
      </small>
    </div>
  )
}

// 일주일 뒤 재판: 거래일 다섯 번이 지난 조개를 다시 따져 본다. 그날 알던 것과 나중에 알게 된 것을 나눠 보여준다.
function TrialBlock({ shell, state, onOpen }) {
  const trial = state?.trial ?? shell.trial
  if (trial) {
    const verdict = VERDICTS[trial.verdict] ?? VERDICTS.unknown
    return (
      <div className={`shell-trial ${trial.verdict}`}>
        <span className="trial-head">⚖️ 일주일 뒤 재판 <b>{verdict.icon} {verdict.label}</b></span>
        <p>{trial.reason}</p>
        {trial.later?.length > 0 && (
          <div className="trial-later">
            <span>그때는 몰랐던 것</span>
            <ul>
              {trial.later.map((item) => (
                <li key={item.text}>
                  {item.text}
                  {item.sources?.length > 0 && (
                    <small>
                      {item.sources.map((source, index) => (
                        <span key={source.link}>
                          {index > 0 && ' · '}
                          <a href={source.link} target="_blank" rel="noopener noreferrer">{source.source || '기사'}{source.day && ` ${formatDay(source.day)}`}</a>
                        </span>
                      ))}
                    </small>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {trial.afterwards?.length > 0 && (
          <div className="trial-after">
            <span>그 뒤 거래일</span>
            <ol>
              {trial.afterwards.map((item) => (
                <li key={item.day}>
                  <small>{formatDay(item.day)}</small>
                  <b className={item.changeRate < 0 ? 'down' : 'up'}>{signed(item.changeRate)}</b>
                  <span>{item.title}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {trial.lesson && <p className="trial-lesson">💡 {trial.lesson}</p>}
      </div>
    )
  }
  if (state === 'loading') return <p className="shell-trial waiting">⚖️ 포리가 그 뒤 기록과 기사를 다시 읽고 있어요…</p>
  if (state?.error) return <p className="shell-trial waiting">⚖️ 재판을 열지 못했어요. 잠시 뒤 다시 해 주세요.</p>
  if (shell.status === 'ready') {
    return (
      <button type="button" className="trial-open" onClick={() => onOpen(shell.day)}>
        ⚖️ 일주일이 지났어요. 이 설명, 지금 봐도 맞을까요? <b>재판 열기</b>
      </button>
    )
  }
  if (shell.status === 'waiting') {
    return <p className="shell-trial waiting">⚖️ 거래일 {shell.daysLeft}일이 더 지나면 이 조개를 다시 따져 볼게요.</p>
  }
  return null
}

// 포리의 보물상자: 날짜순으로 보거나, 범인이 있던 섬의 장소별(도감)로 본다.
// 조개를 누르면 그날 이야기와 "비슷했던 날"이 함께 나온다.
export default function ShellChest({ shells, freshDays = [], onClose }) {
  const real = sortShells(shells)
  const isSample = real.length === 0
  const list = isSample ? SAMPLE_SHELLS : real
  const [view, setView] = useState('days')
  const [activeDay, setActiveDay] = useState(list[0]?.day ?? null)
  const active = list.find((shell) => shell.day === activeDay) ?? null
  const similar = active ? similarDays(active, list) : null
  const pages = SHELL_PAGES.map((page) => ({ ...page, shells: list.filter((shell) => pageOf(shell) === page) }))
  // 재판 결과: day → 'loading' | { trial } | { error }
  const [trials, setTrials] = useState({})
  // 증권사 확인: day → 'loading' | { status, brokerCheck }
  const [checks, setChecks] = useState({})
  const [today] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()))
  const activeCheckDay = active && !isSample && !active.brokerCheck && active.day < today && active.title !== '조용한 날' ? active.day : null
  useEffect(() => {
    if (!activeCheckDay || checks[activeCheckDay]) return undefined
    let cancelled = false
    const id = window.setTimeout(() => {
      setChecks((current) => ({ ...current, [activeCheckDay]: 'loading' }))
      fetch(`/api/broker-check?day=${activeCheckDay}`)
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null)
        .then((data) => { if (!cancelled) setChecks((current) => ({ ...current, [activeCheckDay]: data ?? { status: 'error' } })) })
    }, 0)
    return () => { cancelled = true; window.clearTimeout(id) }
  }, [activeCheckDay, checks])
  const fresh = new Set(isSample ? [] : freshDays)
  const trialOf = (shell) => trials[shell.day]?.trial ?? shell.trial ?? null
  const readyCount = list.filter((shell) => shell.status === 'ready' && !trialOf(shell)).length

  const openTrial = (day) => {
    setTrials((current) => ({ ...current, [day]: 'loading' }))
    fetch(`/api/trial?day=${day}`)
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)
      .then((data) => setTrials((current) => ({ ...current, [day]: data?.trial ? { trial: data.trial } : { error: data?.status ?? 'failed' } })))
  }
  const buttonProps = (shell) => ({
    shell, active: shell.day === activeDay, onPick: setActiveDay, fresh: fresh.has(shell.day), trial: trialOf(shell),
  })

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
          : fresh.size > 0
            ? `포리가 새로 주워 온 조개가 ${fresh.size}개 있어요. 들르지 않은 날 것도 포리가 대신 챙겨 뒀어요.`
            : '장이 열린 날마다 포리가 그날 시장을 움직인 이야기를 조개로 주워 와요.'}
      </p>
      {readyCount > 0 && <p className="shell-note trial-count">⚖️ 일주일이 지나 다시 따져 볼 수 있는 조개가 {readyCount}개 있어요.</p>}
      <div className="shell-tabs" role="tablist" aria-label="보는 방식">
        <button type="button" role="tab" aria-selected={view === 'days'} className={view === 'days' ? 'on' : ''} onClick={() => setView('days')}>날짜순</button>
        <button type="button" role="tab" aria-selected={view === 'pages'} className={view === 'pages' ? 'on' : ''} onClick={() => setView('pages')}>원인별 도감</button>
      </div>

      {view === 'days' ? (
        <ol className="shell-grid">
          {list.map((shell) => (
            <li key={shell.day}>
              <ShellButton {...buttonProps(shell)} showPage />
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
                    <ShellButton {...buttonProps(shell)} />
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
          <BrokerStamp check={active.brokerCheck ? { status: 'done', brokerCheck: active.brokerCheck } : checks[active.day]} />
          <TrialBlock shell={active} state={trials[active.day]} onOpen={openTrial} />
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
