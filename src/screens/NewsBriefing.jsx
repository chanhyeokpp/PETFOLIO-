import { useEffect, useState } from 'react'
import { buildFacts } from '../domain/facts'
import { CONFIDENCE, DEMO_NEWS, SCENE_TAGS, SENTIMENTS } from '../domain/news'

// 오늘의 시황: 글을 줄이고 모양과 움직임으로 읽히게.
// 결과(큰 숫자와 파도) → 맞히기(문장 세 개) → 범인 카드(도장) → 원인 흐름(점선이 흐름) → 숫자 막대 → 짧은 소식.

const signed = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
const formatDay = (day) => {
  const [, month, date] = day.split('-').map(Number)
  return `${month}/${date}`
}
const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

// 숫자가 0에서 target까지 차오른다
function useCountUp(target, ms = 900) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!Number.isFinite(target)) return undefined
    if (reducedMotion()) {
      const id = requestAnimationFrame(() => setValue(target))
      return () => cancelAnimationFrame(id)
    }
    let frame
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms)
      setValue(target * (1 - (1 - t) ** 3))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, ms])
  return value
}

const toneOf = (changeRate) => (!Number.isFinite(changeRate) || Math.abs(changeRate) < 0.3 ? 'flat' : changeRate > 0 ? 'rise' : 'fall')

// ---------- 결과: 큰 숫자, 화살표, 크기만큼 높아지는 파도 ----------
function ResultHero({ changeRate, label = '오늘 코스피', note = null, compact = false, inset = false }) {
  const shown = useCountUp(changeRate)
  const tone = toneOf(changeRate)
  const size = Number.isFinite(changeRate) ? Math.abs(changeRate) : 0
  const word = tone === 'flat' ? '거의 그대로' : `${size >= 1.5 ? '크게 ' : ''}${tone === 'rise' ? '올랐어요' : '내렸어요'}`
  // 파도 높이와 빠르기: 많이 움직인 날일수록 높고 빠르게
  const level = Math.min(1, size / 5)
  return (
    <section className={`result-hero ${tone} ${compact ? 'compact' : ''} ${inset ? 'inset' : ''}`} style={{ '--level': level }} aria-label={`${label} ${Number.isFinite(changeRate) ? signed(changeRate) : ''}`}>
      <div className="hero-text">
        <small>{label}</small>
        <div className="hero-number">
          {tone !== 'flat' && <span className="hero-arrow" aria-hidden="true" />}
          <strong>{Number.isFinite(changeRate) ? signed(shown) : '—'}</strong>
        </div>
        <span className="hero-word">{word}</span>
        {note && <span className="hero-note">{note}</span>}
      </div>
      <svg className="hero-sea" viewBox="0 0 800 120" preserveAspectRatio="none" aria-hidden="true">
        <path className="wave back" d="M0 60 Q 50 30 100 60 T 200 60 T 300 60 T 400 60 T 500 60 T 600 60 T 700 60 T 800 60 T 900 60 T 1000 60 T 1100 60 T 1200 60 T 1300 60 T 1400 60 T 1500 60 T 1600 60 V 120 H 0 Z" />
        <path className="wave front" d="M0 70 Q 50 45 100 70 T 200 70 T 300 70 T 400 70 T 500 70 T 600 70 T 700 70 T 800 70 T 900 70 T 1000 70 T 1100 70 T 1200 70 T 1300 70 T 1400 70 T 1500 70 T 1600 70 V 120 H 0 Z" />
      </svg>
    </section>
  )
}

// ---------- 맞히기 ----------
const subjectOf = (word) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (code < 0 || code > 11171) return `${word}이(가)`
  return `${word}${code % 28 ? '이' : '가'}`
}
// 예전 기록엔 문장이 없어서 숫자로 만든다
function statementOf(item) {
  if (item.statement) return item.statement
  const { label, value, amount } = parseFootprint(item)
  if (!amount) return null
  if (item.tag === 'fx') return amount > 0 ? '환율이 올라 원화가 약해져서' : '환율이 내려 원화가 강해져서'
  if (item.tag === 'flow') return `${subjectOf(label)} ${value.replace(/\s*순매(도|수)/, '')}어치를 ${amount < 0 ? '팔아서' : '사서'}`
  return `${subjectOf(label)} ${Math.abs(amount) > 0.35 ? '크게 ' : ''}${amount > 0 ? '올라서' : '내려서'}`
}

// 보기 세 개: 정답(오늘의 범인)과, 오늘 실제로 일어난 일 가운데 그럴듯한 둘. 정답 자리는 날마다 바뀐다.
function buildChoices(culprit, footprints) {
  const plausible = (item) => (item.notable ? 2 : 0) + (item.agrees ? 1 : 0)
  const others = (footprints ?? [])
    .filter((item) => item.tag !== culprit.tag && statementOf(item))
    .sort((a, b) => plausible(b) - plausible(a))
    .slice(0, 2)
    .map((item) => ({ key: item.tag, text: statementOf(item), print: item }))
  const list = [{ key: 'culprit', text: `${culprit.title} 때문에` }, ...others]
  const shift = [...culprit.title].reduce((sum, char) => sum + char.charCodeAt(0), 0) % list.length
  return [...list.slice(shift), ...list.slice(0, shift)]
}

const wasIt = (word) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  return code >= 0 && code <= 11171 && code % 28 === 0 ? `${word}였어요` : `${word}이었어요`
}

// 점수나 기록은 남기지 않는다: 틀려도 배울 거리만 준다.
function guessFeedback(choice, culprit) {
  if (choice.key === 'culprit') return { tone: 'right', text: '맞혔어요! 기사들도 같은 걸 원인으로 짚었어요.' }
  if (choice.print?.agrees && choice.print.notable) {
    return { tone: 'close', text: `그것도 실제로 일어난 일이에요. 다만 기사들은 그보다 "${culprit.title}" 쪽을 더 크게 봤어요.` }
  }
  return { tone: 'other', text: `이번엔 ${wasIt(culprit.title)}.` }
}

function GuessStep({ choices, onPick }) {
  return (
    <section className="guess-step" aria-label="범인 맞히기">
      <strong>왜 그랬을 것 같아요?</strong>
      <div className="guess-pills">
        {choices.map((choice, index) => (
          <button key={choice.key} type="button" className="guess-pill" style={{ '--i': index }} onClick={() => onPick(choice)}>
            {choice.text}
          </button>
        ))}
      </div>
      <button type="button" className="text-button guess-skip" onClick={() => onPick('skipped')}>잘 모르겠어요, 바로 볼래요</button>
    </section>
  )
}

// ---------- 원인 흐름: 단계 사이로 점선이 흐른다 ----------
function CauseFlow({ steps, tone }) {
  if (!steps.length) return null
  return (
    <ol className={`cause-flow ${tone}`} aria-label="원인 흐름">
      {steps.map((step, index) => (
        <li key={step} style={{ '--i': index }} className={index === steps.length - 1 ? 'end' : ''}>
          {index > 0 && <i className="flow-line" aria-hidden="true" />}
          <span>{step}</span>
        </li>
      ))}
    </ol>
  )
}

// ---------- 숫자 막대: 가운데에서 내림은 왼쪽, 오름은 오른쪽. 같은 쪽을 가리킨 것은 진하게 ----------
const parseFootprint = (item) => {
  const text = item.text ?? ''
  const label = text.replace(/\s*[+-]?[\d.,]+\s*(%|조원|억원).*$/, '').trim() || text
  const value = text.slice(label.length).trim()
  let amount = 0
  const percent = text.match(/([+-]?\d+(?:\.\d+)?)%/)
  if (percent) {
    const full = item.tag === 'fx' ? 1.5 : 8
    amount = Number(percent[1]) / full
  } else {
    const money = text.match(/([\d.,]+)\s*(조|억)/)
    if (money) {
      const eok = Number(money[1].replaceAll(',', '')) * (money[2] === '조' ? 10_000 : 1)
      amount = (text.includes('순매도') ? -eok : eok) / 20_000
    }
  }
  return { label, value, amount: Math.max(-1, Math.min(1, amount)) }
}

function FootprintBars({ footprints, tone }) {
  if (!footprints?.length) return null
  return (
    <div className="bars-block">
      <div className="block-head">
        <span className="block-label">숫자도 같은 쪽이었을까?</span>
        <span className="block-hint">진한 막대 = 코스피와 같은 쪽</span>
      </div>
      <ul className={`foot-bars ${tone}`}>
        {footprints.map((item, index) => {
          const { label, value, amount } = parseFootprint(item)
          const width = `${Math.max(4, Math.abs(amount) * 50)}%`
          const state = !item.notable ? 'calm' : item.agrees ? 'agrees' : 'against'
          return (
            <li key={item.tag} className={state} style={{ '--i': index }}>
              <span className="bar-label">{label}</span>
              <span className="bar-track">
                <i className={`bar-fill ${amount < 0 ? 'left' : 'right'}`} style={{ '--w': width }} />
              </span>
              <span className="bar-value">{value}</span>
            </li>
          )
        })}
      </ul>
      <div className="bars-legend" aria-hidden="true">
        <span />
        <span className="legend-track"><b>← 내림 · 팔았음</b><b>오름 · 샀음 →</b></span>
        <span />
      </div>
    </div>
  )
}

function SuspectChips({ suspects, label }) {
  if (!suspects?.length) return null
  return (
    <div className="chips-block">
      <span className="block-label">{label}</span>
      <div className="chips">
        {suspects.map((item) => <span key={item.title} className="chip">{item.title}</span>)}
      </div>
    </div>
  )
}

// ---------- 범인 카드 (도장이 찍힌다) ----------
function WantedCard({ culprit, result, tone }) {
  const confidence = CONFIDENCE[culprit.confidence]
  const brokers = culprit.brokerCount ?? 0
  const press = Math.max(0, (culprit.outletCount ?? 0) - brokers)
  return (
    <section className={`wanted ${tone}`} aria-label="오늘의 범인">
      <span className="wanted-label">범인</span>
      <strong className="wanted-title">{culprit.title}</strong>
      {confidence && (
        <span className={`stamp ${culprit.confidence}`} title={confidence.note} aria-label={`확신도 ${confidence.label}`}>
          {confidence.label}
        </span>
      )}
      {culprit.summary && <p className="wanted-summary">{culprit.summary}</p>}
      <CauseFlow steps={[...(culprit.chain ?? []), result].filter(Boolean)} tone={tone} />
      {(culprit.sources?.length ?? 0) > 0 && (
        <div className="wanted-sources">
          {brokers > 0 && <span className="count broker">증권사 {brokers}</span>}
          {press > 0 && <span className="count">언론사 {press}</span>}
          {culprit.sources.map((item) => (
            <a key={item.link} className={item.kind === 'broker' ? 'broker' : ''} href={item.link} target="_blank" rel="noopener noreferrer" title={item.title}>
              {item.source || '기사'}
            </a>
          ))}
        </div>
      )}
    </section>
  )
}

function FogCard({ quietTitle, quietMessage }) {
  return (
    <section className="fog-case" aria-label="안개 낀 날">
      <span className="fog-blob a" aria-hidden="true" />
      <span className="fog-blob b" aria-hidden="true" />
      <span className="fog-blob c" aria-hidden="true" />
      <span className="wanted-label">안개 낀 날</span>
      <strong className="wanted-title">{quietTitle ?? '뚜렷한 범인이 없어요'}</strong>
      {quietMessage && <p className="wanted-summary">{quietMessage}</p>}
      <p className="fog-lesson">시장은 이유 없이도 출렁여요. 억지로 이유를 붙이지 않는 것도 실력이에요.</p>
    </section>
  )
}

// ---------- 하루치 사건을 카드 한 장에: 결과 → (맞히기) → 범인 → 탭(증거 · 용의자 · 소식) ----------
function CaseBoard({ briefing, changeRate, label = '오늘 코스피', notice = null, sample = false }) {
  const { culprit, footprints, suspects, items } = briefing
  const tone = toneOf(changeRate)
  const [guess, setGuess] = useState(culprit ? null : 'skipped')
  const [tab, setTab] = useState('evidence')
  const revealed = guess !== null
  const result = Number.isFinite(changeRate) ? `코스피 ${signed(changeRate)}` : null
  const feedback = guess && guess !== 'skipped' ? guessFeedback(guess, culprit) : null
  const tabs = [
    { key: 'evidence', label: '증거', count: null, show: footprints?.length > 0 },
    { key: 'suspects', label: culprit ? '다른 용의자' : '기사 속 후보', count: suspects?.length, show: suspects?.length > 0 },
    { key: 'news', label: '알아둘 소식', count: items?.length, show: items?.length > 0 },
  ].filter((item) => item.show)
  const active = tabs.find((item) => item.key === tab)?.key ?? tabs[0]?.key

  return (
    <section className={`board ${tone}`} aria-label="오늘의 사건">
      <ResultHero changeRate={changeRate} label={label} inset compact={revealed} />
      {notice && <p className="board-notice">{notice}</p>}
      <div className="board-body">
        {!revealed ? (
          <GuessStep choices={buildChoices(culprit, footprints)} onPick={setGuess} />
        ) : (
          <>
            {feedback && <p className={`guess-toast ${feedback.tone}`} role="status">{feedback.text}</p>}
            {culprit
              ? <WantedCard culprit={culprit} result={result} tone={tone} />
              : <FogCard quietTitle={briefing.quietTitle} quietMessage={briefing.quietMessage} />}
          </>
        )}
      </div>
      {revealed && tabs.length > 0 && (
        <div className="board-tabs">
          <div className="tab-row" role="tablist" aria-label="더 보기">
            {tabs.map((item) => (
              <button
                key={item.key} type="button" role="tab" aria-selected={active === item.key}
                className={active === item.key ? 'on' : ''} onClick={() => setTab(item.key)}
              >
                {item.label}{item.count ? <b>{item.count}</b> : null}
              </button>
            ))}
          </div>
          <div className="board-panel" role="tabpanel" key={active}>
            {active === 'evidence' && <FootprintBars footprints={footprints} tone={tone} />}
            {active === 'suspects' && <SuspectChips suspects={suspects} label={culprit ? '기사들이 함께 짚은 다른 원인' : '기사에 나온 후보'} />}
            {active === 'news' && <NewsMini items={items} sample={sample} bare />}
          </div>
        </div>
      )}
    </section>
  )
}

// ---------- 소식: 한 줄씩, 누르면 펼친다 ----------
function NewsMini({ items, sample = false, bare = false }) {
  if (!items?.length) return null
  return (
    <section className="news-mini" aria-label="알아둘 소식">
      {!bare && (
        <div className="block-head">
          <span className="block-label">알아둘 소식</span>
          {sample && <span className="sample-badge">예시 · 실제 기사 아님</span>}
        </div>
      )}
      {bare && sample && <span className="sample-badge">예시 · 실제 기사 아님</span>}
      <ol>
        {items.map((item, index) => {
          const tag = SCENE_TAGS[item.tag] ?? SCENE_TAGS.other
          return (
            <li key={item.id ?? item.title} style={{ '--i': index }}>
              <details>
                <summary>
                  <i className={`dot ${item.sentiment}`} title={SENTIMENTS[item.sentiment]} />
                  <span className="mini-title">{item.title}</span>
                  <em>{tag.label}</em>
                </summary>
                <div className="mini-body">
                  <p>{item.summary}</p>
                  <div className="mini-meta">
                    <span className={`sentiment ${item.sentiment}`}>{SENTIMENTS[item.sentiment]}</span>
                    {tag.ready && <span>섬에서: {tag.scene}</span>}
                    {item.sources?.[0]?.link && (
                      <a href={item.sources[0].link} target="_blank" rel="noopener noreferrer">{item.sources[0].source || '기사'}</a>
                    )}
                  </div>
                </div>
              </details>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// 범인을 아직 못 정했을 때: 숫자로 확인되는 사실만 막대로
function LiveFacts({ changeRate, flows, drivers, message }) {
  const facts = buildFacts({ changeRate, flows, drivers }).filter((fact) => !fact.main)
  const footprints = facts.map((fact) => ({
    tag: fact.key === 'foreign' ? 'flow' : fact.key === 'usdkrw' ? 'fx' : fact.key,
    text: `${fact.label} ${fact.value}`,
    agrees: true,
    notable: Boolean(fact.note && fact.note !== '평소보다 잔잔'),
  }))
  return (
    <section className={`board ${toneOf(changeRate)}`} aria-label="오늘 움직인 것">
      <ResultHero changeRate={changeRate} inset />
      <p className="board-notice">{message}</p>
      <div className="board-body">
        <FootprintBars footprints={footprints} tone={toneOf(changeRate)} />
      </div>
    </section>
  )
}

export default function NewsBriefing({
  marketState, changeRate, characterName, isLive, flows, drivers, news, briefing, briefingInfo, nextLetter, onDone,
}) {
  const sample = DEMO_NEWS[marketState]
  const isLoading = marketState === 'loading' || (isLive && news === undefined)
  const liveDay = isLive && Number.isFinite(changeRate) && marketState !== 'closed'
  const hasAiBriefing = liveDay && Boolean(briefing) && (briefing.culprit || briefing.items.length > 0)
  const previous = briefingInfo?.previous
  const waitingForClose = isLive && !hasAiBriefing && previous && ['before-close', 'closed', 'few-headlines'].includes(briefingInfo?.reason)

  return (
    <main className="screen news-screen">
      <header className="news-header compact">
        <div>
          <p className="eyebrow">오늘의 시황</p>
          <h1 className="screen-title">오늘 바다에 무슨 일이 있었을까요?</h1>
        </div>
        <button type="button" className="text-button" onClick={onDone}>건너뛰기</button>
      </header>

      {isLoading && <ResultHero changeRate={NaN} label={`${characterName}가 소식을 모으는 중이에요`} />}

      {!isLoading && hasAiBriefing && <CaseBoard briefing={briefing} changeRate={changeRate} />}

      {!isLoading && waitingForClose && (
        <CaseBoard
          briefing={previous.briefing} changeRate={previous.changeRate} label={`${formatDay(previous.day)} 코스피`}
          notice={`${marketState === 'closed' ? '오늘은 장이 쉬어요' : `지금 코스피 ${liveDay ? signed(changeRate) : ''} · 오늘의 범인은 오후 4시쯤 밝혀져요`}. 그동안 지난 거래일(${formatDay(previous.day)}) 이야기예요.`}
        />
      )}

      {!isLoading && liveDay && !hasAiBriefing && !waitingForClose && (
        <LiveFacts
          changeRate={changeRate} flows={flows} drivers={drivers}
          message={briefing === undefined ? `${characterName}가 기사를 읽고 오늘의 범인을 찾는 중이에요…` : '숫자로 확인되는 사실만 모았어요.'}
        />
      )}

      {!isLoading && !isLive && sample && (
        <CaseBoard briefing={sample} changeRate={changeRate} sample />
      )}

      {!isLoading && !hasAiBriefing && !waitingForClose && !liveDay && !(isLive === false && sample) && (
        <p className="case-banner">오늘 소식을 가져오지 못했어요. 바로 {characterName}를 만나러 가도 괜찮아요.</p>
      )}

      {nextLetter && (
        <p className="next-letter">
          수평선에 병편지가 떠 있어요 · <b>{nextLetter.dday === 0 ? '오늘' : nextLetter.dday === 1 ? '내일' : `${nextLetter.dday}일 뒤`} {nextLetter.title}</b>
        </p>
      )}
      <button type="button" className="primary-button" onClick={onDone}>{characterName} 보러 가기</button>
    </main>
  )
}

