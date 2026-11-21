import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEMO_SCENARIOS, getMarketState } from './domain/market'
import { formatEok } from './domain/facts'
import { getMarket } from './domain/markets'
import { SENTIMENTS } from './domain/news'
import MarketSelect from './screens/MarketSelect'
import NewsBriefing from './screens/NewsBriefing'
import './App.css'

const Pori3D = lazy(() => import('./Pori3D'))
const PoriIsland = lazy(() => import('./PoriIsland'))

// 기본은 섬 장면. 주소 끝에 ?scene=sea 를 붙이면 예전 바다 단면 장면으로 볼 수 있다.
const SCENE_MODE = new URLSearchParams(window.location.search).get('scene') === 'sea' ? 'sea' : 'island'

// 오늘 이야기의 분류 → 포리가 가 있는 곳
const PLACE_BY_TAG = { flow: 'dock', us: 'lighthouse', fx: 'lighthouse', leader: 'shore', stock: 'shore' }
const PLACE_LINES = {
  dock: '선착장에서 오가는 배를 보고 있어요',
  lighthouse: '등대에서 외해를 바라보고 있어요',
  shore: '물가에서 고래와 물고기를 보고 있어요',
  home: '집에서 쉬고 있어요',
}

const PORI_REACTIONS = {
  rise: { title: '포리가 신나게 점프했어요!', message: '오늘도 같이 배워봐요 ☀️' },
  flat: { title: '포리가 인사해요!', message: '안녕! 천천히 살펴봐요 👋' },
  fall: { title: '토닥토닥, 고마워요', message: '포리가 다시 힘을 냈어요 💙' },
  closed: { title: '쉿, 포리가 자고 있어요', message: '장이 열리면 다시 만나요 🌙' },
  loading: { title: '포리가 열심히 살펴보는 중!', message: '조금만 기다려 주세요.' },
  error: { title: '포리가 다시 확인해 볼게요', message: '한 번 더 힘내볼게요!' },
}

const STORAGE_KEYS = { market: 'petfolio.market', newsSeen: 'petfolio.newsSeen' }

// storage can be blocked (private windows); the flow must still work without it
const readStored = (key) => {
  try { return window.localStorage.getItem(key) } catch { return null }
}
const writeStored = (key, value) => {
  try { window.localStorage.setItem(key, value) } catch { /* not remembered, that's all */ }
}
const getTodayKst = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())

// first visit → pick a market; first visit of the day → news; otherwise straight to the scene
const getInitialScreen = () => {
  if (!getMarket(readStored(STORAGE_KEYS.market))?.available) return 'select'
  return readStored(STORAGE_KEYS.newsSeen) === getTodayKst() ? 'scene' : 'news'
}

// 하루 변화율(%)이 이만큼이면 장면에서 최대로 표현한다.
const CAUSES = [
  { key: 'us', driver: 'nasdaq', label: '간밤 나스닥 → 날씨', full: 1.5, scale: ['비', '구름 조금', '맑음'] },
  { key: 'fx', driver: 'usdkrw', label: '원/달러 환율 → 바람', full: 1, scale: ['환율 하락 (오른쪽으로)', '잔잔', '환율 상승 (왼쪽으로)'] },
  { key: 'samsung', driver: 'samsung', label: '삼성전자 → 파란 고래', full: 5, scale: ['가라앉아요', '떠 있어요', '뛰어올라요'] },
  { key: 'hynix', driver: 'hynix', label: 'SK하이닉스 → 주황 고래', full: 5, scale: ['가라앉아요', '떠 있어요', '뛰어올라요'] },
]
const DEMO_CAUSES = { us: 0.8, fx: -0.3, samsung: 1.6, hynix: -1.2 }
// 화제 종목: 하루 변화율이 이만큼(%)이면 물고기가 가장 크게 뛰거나 가라앉는다.
const FULL_MOVER_PERCENT = 10
const DEMO_MOVERS = [
  { name: '예시전자', changePercent: 7.2 },
  { name: '예시바이오', changePercent: -6.1 },
  { name: '예시중공업', changePercent: 4.4 },
]

function App() {
  const [screen, setScreen] = useState(getInitialScreen)
  const [marketId, setMarketId] = useState(() => readStored(STORAGE_KEYS.market) ?? 'kospi')
  const character = getMarket(marketId) ?? getMarket('kospi')
  const [scenario, setScenario] = useState(DEMO_SCENARIOS.loading)
  const [dataMode, setDataMode] = useState('loading')
  const [tradingValue, setTradingValue] = useState(12_000_000_000_000)
  const [tradingValueMode, setTradingValueMode] = useState('demo')
  const [dayRange, setDayRange] = useState(1.1)
  const [dayRangeMode, setDayRangeMode] = useState('demo')
  const [tradingValueSource, setTradingValueSource] = useState('KRX')
  const [flows, setFlows] = useState({ foreign: 2500, institution: -1200, individual: -1300 })
  const [flowMode, setFlowMode] = useState('demo')
  const [drivers, setDrivers] = useState(null)
  // 장면에 쓰는 원인 값(하루 변화율 %). 실제 데이터가 오면 덮어쓰고, 슬라이더로 바꿔볼 수 있다.
  const [causes, setCauses] = useState(DEMO_CAUSES)
  const [causeMode, setCauseMode] = useState('demo')
  const [movers, setMovers] = useState(DEMO_MOVERS)
  const [moverMode, setMoverMode] = useState('demo')
  const fish = useMemo(() => movers.map((item) => ({
    name: item.name,
    level: Math.min(1, Math.max(-1, item.changePercent / FULL_MOVER_PERCENT)),
  })), [movers])
  const causeLevel = (key) => {
    const { full } = CAUSES.find((item) => item.key === key)
    return Math.min(1, Math.max(-1, causes[key] / full))
  }
  // undefined = 아직 받는 중, null = 못 받음
  const [news, setNews] = useState(undefined)
  const [briefing, setBriefing] = useState(undefined)
  const [reaction, setReaction] = useState(null)
  const [reactionTick, setReactionTick] = useState(0)
  // 장면에서 누른 것(배, 날씨, 고래). null이면 말풍선을 보여준다.
  const [picked, setPicked] = useState(null)
  const reactionTimer = useRef(null)
  const marketState = scenario.state ?? getMarketState(scenario.changeRate)
  const isUnavailable = marketState === 'loading' || marketState === 'error'
  const tradingActivity = Math.min(1, Math.max(0.08, tradingValue / 20_000_000_000_000))
  const volatility = Math.min(1, Math.max(0, (dayRange - 0.6) / 2.4))
  const toFlowLevel = (eok) => Math.min(1, Math.max(-1, eok / 10_000))
  const formatFlow = (eok) => `${eok > 0 ? '+' : ''}${Math.round(eok).toLocaleString('ko-KR')}억`

  const loadKospi = useCallback(async () => {
    setDataMode('loading')
    setScenario(DEMO_SCENARIOS.loading)

    try {
      const response = await fetch('/api/kospi')
      if (!response.ok) throw new Error('KOSPI 데이터를 불러오지 못했어요.')

      const data = await response.json()
      const copy = DEMO_SCENARIOS[data.marketState] ?? DEMO_SCENARIOS.flat
      const updatedAt = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(data.marketTime))

      setScenario({
        ...copy,
        key: 'live',
        label: '실제 KOSPI',
        kospiValue: data.kospiValue,
        changeRate: data.changeRate,
        updatedAt,
      })
      if (Number.isFinite(data.tradingValue)) {
        setTradingValue(data.tradingValue)
        setTradingValueMode('live')
        setTradingValueSource(data.tradingValueSource === 'Naver' ? '네이버 금융' : 'KRX')
      } else {
        setTradingValueMode('demo')
      }
      if (data.investors) {
        setFlows(data.investors)
        setFlowMode('live')
      } else {
        setFlowMode('demo')
      }
      setDrivers(data.drivers ?? null)
      if (data.movers?.length) {
        setMovers(data.movers)
        setMoverMode('live')
      } else {
        setMovers(DEMO_MOVERS)
        setMoverMode('demo')
      }
      if (data.drivers && CAUSES.every(({ driver }) => data.drivers[driver])) {
        setCauses(Object.fromEntries(CAUSES.map(({ key, driver }) => [key, data.drivers[driver].changePercent])))
        setCauseMode('live')
      } else {
        setCauseMode('demo')
      }
      if (Number.isFinite(data.dayRangePercent)) {
        setDayRange(data.dayRangePercent)
        setDayRangeMode('live')
      } else {
        setDayRangeMode('demo')
      }
      setDataMode('live')
    } catch {
      setScenario({
        ...DEMO_SCENARIOS.rise,
        key: 'fallback',
        label: '데모 대체',
        title: '데모 화면을 보여드릴게요',
        message: '실제 데이터 연결이 잠시 어려워요.',
      })
      setDataMode('fallback')
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(loadKospi, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadKospi])

  useEffect(() => () => window.clearTimeout(reactionTimer.current), [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/news')
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)
      .then((data) => { if (!cancelled) setNews(data) })
    // 기사 제목을 LLM이 읽는 데 십여 초 걸려서 따로 받는다
    fetch('/api/briefing')
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)
      .then((data) => { if (!cancelled) setBriefing(data?.briefing ?? null) })
    return () => { cancelled = true }
  }, [])

  const selectDemoScenario = (item) => {
    setScenario(item)
    setDataMode('demo')
  }

  const confirmMarket = (id) => {
    setMarketId(id)
    writeStored(STORAGE_KEYS.market, id)
    setScreen('news')
  }

  const finishNews = () => {
    writeStored(STORAGE_KEYS.newsSeen, getTodayKst())
    setScreen('scene')
  }

  useEffect(() => {
    if (!picked) return undefined
    const onKey = (event) => { if (event.key === 'Escape') setPicked(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picked])

  // 누른 대상의 숫자, 장면에서의 의미, 관련 뉴스
  // 포리가 오늘 가 있을 곳: 실제 데이터면 오늘의 범인, 시연 중이면 가장 크게 움직인 원인
  const getFocus = () => {
    if (marketState === 'closed') return 'home'
    if (isUnavailable) return 'lighthouse'
    const allLive = dataMode === 'live' && causeMode === 'live' && flowMode === 'live'
    if (allLive && briefing?.culprit && PLACE_BY_TAG[briefing.culprit.tag]) return PLACE_BY_TAG[briefing.culprit.tag]
    const candidates = [
      ['lighthouse', Math.abs(causeLevel('us'))],
      ['lighthouse', Math.abs(causeLevel('fx'))],
      ['dock', Math.abs(toFlowLevel(flows.foreign))],
      ['shore', Math.max(Math.abs(causeLevel('samsung')), Math.abs(causeLevel('hynix')))],
    ]
    return candidates.reduce((best, item) => (item[1] > best[1] ? item : best))[0]
  }
  const focus = getFocus()

  const pick = (name) => {
    if (name === 'pori') {
      touchPori()
      return
    }
    setPicked(name)
  }

  const getPickedInfo = () => {
    const percent = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
    const relatedNews = (tag) => (dataMode === 'live' ? briefing?.items ?? [] : []).filter((item) => item.tag === tag).slice(0, 2)
    const flowInfo = (key, name) => ({
      title: `${name} 배`,
      value: `${formatEok(flows[key]).replace(/^[+-]/, '')} ${flows[key] < 0 ? '순매도' : '순매수'}`,
      tone: flows[key] < 0 ? 'down' : 'up',
      lines: [`${name}이 사면 짐을 싣고 포리 곁으로 오고, 팔면 뱃머리를 돌려 떠나요.`],
      news: relatedNews('flow'),
    })
    const whaleInfo = (key, name) => {
      const versus = causeMode === 'live' ? drivers?.[key]?.versusIndex : null
      const lines = ['덩치가 커서 지수를 끌고 가는 종목이에요. 오르면 뛰어오르고 내리면 가라앉아요.']
      if (Number.isFinite(versus) && Math.abs(versus) >= 0.5) {
        lines.push(`오늘은 코스피보다 ${Math.abs(versus).toFixed(1)}%p 더 ${versus < 0 ? '내렸어요' : '올랐어요'}.`)
      }
      return { title: name, value: percent(causes[key]), tone: causes[key] < 0 ? 'down' : 'up', lines, news: relatedNews('leader') }
    }
    if (picked === 'foreign') return flowInfo('foreign', '외국인')
    if (picked === 'institution') return flowInfo('institution', '기관')
    if (picked === 'samsung') return whaleInfo('samsung', '삼성전자')
    if (picked === 'hynix') return whaleInfo('hynix', 'SK하이닉스')
    if (picked?.startsWith('fish')) {
      const mover = movers[Number(picked.slice(4))]
      if (!mover) return null
      return {
        title: moverMode === 'live' ? mover.name : `${mover.name} (예시)`,
        value: percent(mover.changePercent),
        tone: mover.changePercent < 0 ? 'down' : 'up',
        lines: ['오늘 거래가 많았던 종목 가운데 가장 크게 움직였어요. 오르면 뛰어오르고 내리면 물속으로 들어가요.'],
        news: relatedNews('stock'),
      }
    }
    if (picked === 'home') {
      return {
        title: '포리 집',
        value: '준비 중',
        tone: '',
        lines: ['포리가 주워 온 조개를 모아두는 곳이에요. 조개 목걸이는 곧 만들어질 거예요.'],
        news: [],
      }
    }
    if (picked === 'weather' || picked === 'lighthouse') {
      const lines = ['날씨는 간밤 미국 증시예요. 올랐으면 맑고, 내렸으면 비가 와요.']
      if (causes.us > 0.5 && marketState === 'fall') lines.push('미국은 올랐는데 코스피는 내렸어요. 오늘은 미국 탓이 아니에요.')
      if (causes.us < -0.5 && marketState === 'rise') lines.push('미국은 내렸는데 코스피는 올랐어요. 스스로 힘을 낸 날이에요.')
      const fxWord = Math.abs(causes.fx) < 0.15 ? '잔잔해요' : causes.fx > 0 ? '올라서 왼쪽으로 불어요' : '내려서 오른쪽으로 불어요'
      lines.push(`바람은 원/달러 환율이에요. 오늘은 ${percent(causes.fx)}로 ${fxWord}.`)
      return { title: '간밤 나스닥', value: percent(causes.us), tone: causes.us < 0 ? 'down' : 'up', lines, news: relatedNews('us') }
    }
    return null
  }
  const pickedInfo = picked ? getPickedInfo() : null

  const touchPori = () => {
    setPicked(null)
    setReaction(PORI_REACTIONS[marketState] ?? PORI_REACTIONS.flat)
    setReactionTick((current) => current + 1)
    window.clearTimeout(reactionTimer.current)
    reactionTimer.current = window.setTimeout(() => setReaction(null), 2200)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="petfolio 홈">
          petfolio<span>!</span>
        </a>
        <nav className="topbar-actions" aria-label="화면 이동">
          {screen === 'scene' && (
            <>
              <button type="button" className="nav-button" onClick={() => setScreen('select')}>시장 바꾸기</button>
              <button type="button" className="nav-button" onClick={() => setScreen('news')}>오늘 뉴스</button>
            </>
          )}
          <span className="prototype-badge">PM Day prototype</span>
        </nav>
      </header>

      {screen === 'select' && <MarketSelect initialId={marketId} onConfirm={confirmMarket} />}
      {screen === 'news' && (
        <NewsBriefing
          marketState={marketState}
          changeRate={scenario.changeRate}
          characterName={character.name}
          isLive={dataMode === 'live'}
          flows={flowMode === 'live' ? flows : null}
          drivers={drivers}
          news={news}
          briefing={briefing}
          onDone={finishNews}
        />
      )}

      {screen === 'scene' && (
      <>
      <main id="top" className={`dashboard screen ${SCENE_MODE}-layout`}>
        <section className="intro">
          <p className="eyebrow">오늘 주식시장은 어떤 기분일까?</p>
          <h1>숫자보다 먼저,<br />오늘 시장의 분위기를 만나요.</h1>
          <p className="description">
            KOSPI의 움직임을 포리의 표정과 날씨로 쉽게 보여주는 금융 학습 서비스예요.
          </p>

          <article className="market-card" aria-live="polite">
            <div>
              <span className="market-label">KOSPI</span>
              <strong>{isUnavailable ? '—' : scenario.kospiValue.toLocaleString('ko-KR')}</strong>
            </div>
            <span className={`change-rate ${marketState}`}>
              {marketState === 'closed' ? '휴장' : isUnavailable
                ? marketState === 'loading' ? '불러오는 중' : '연결 오류'
                : `${scenario.changeRate > 0 ? '+' : ''}${scenario.changeRate.toFixed(2)}%`}
            </span>
          </article>
          <div className="source-row">
            <span className={`source-badge ${dataMode}`}>
              {dataMode === 'live' && 'Yahoo Finance 지연 데이터'}
              {dataMode === 'loading' && '실제 데이터 확인 중'}
              {dataMode === 'fallback' && '데모 데이터로 자동 전환'}
              {dataMode === 'demo' && '상태 테스트 모드'}
            </span>
            <button type="button" className="refresh-button" onClick={loadKospi}>
              실제 데이터 새로고침
            </button>
          </div>
          <article className="turnover-card">
            <div>
              <span>오늘 거래대금</span>
              <strong>{(tradingValue / 1_000_000_000_000).toFixed(1)}조원</strong>
            </div>
            <small>{tradingValueMode === 'live' ? `${tradingValueSource} 실제값` : '물 높이 시연값'}</small>
          </article>
          <article className="flow-card">
            <header>
              <span>오늘 수급 (순매수)</span>
              <small>{flowMode === 'live' ? '네이버 금융' : '배 시연값'}</small>
            </header>
            <div className="flow-row">
              <span className="flow-item foreign"><i aria-hidden="true" />외국인 <b>{formatFlow(flows.foreign)}</b></span>
              <span className="flow-item institution"><i aria-hidden="true" />기관 <b>{formatFlow(flows.institution)}</b></span>
              {Number.isFinite(flows.individual) && flowMode === 'live' && (
                <span className="flow-item individual">개인 <b>{formatFlow(flows.individual)}</b></span>
              )}
            </div>
          </article>
          {drivers && Object.values(drivers).some(Boolean) && (
            <article className="driver-card">
              <header>
                <span>시장 밖에서 온 영향</span>
                <small>Yahoo Finance 지연 데이터</small>
              </header>
              <div className="driver-row">
                {Object.entries(drivers).filter(([, item]) => item).map(([key, item]) => (
                  <span key={key} className={`driver-item ${item.changePercent > 0 ? 'up' : item.changePercent < 0 ? 'down' : ''}`}>
                    {item.label}
                    <b>{item.changePercent > 0 ? '+' : ''}{item.changePercent.toFixed(2)}%</b>
                  </span>
                ))}
              </div>
            </article>
          )}
          <article className="turnover-card range-card">
            <div>
              <span>오늘 출렁임 (고가-저가)</span>
              <strong>{dayRange.toFixed(2)}%</strong>
            </div>
            <small>{dayRangeMode === 'live' ? 'Yahoo Finance 지연 데이터' : '파도 세기 시연값'}</small>
          </article>
        </section>

        <section className={`pori-stage ${marketState} ${SCENE_MODE}`} aria-label={`포리 상태: ${scenario.label}`}>
          <Suspense fallback={null}>
            {SCENE_MODE === 'island' ? (
              <PoriIsland
                marketState={marketState} touchSignal={reactionTick} waterLevel={tradingActivity} volatility={volatility}
                foreignFlow={toFlowLevel(flows.foreign)}
                institutionFlow={toFlowLevel(flows.institution)}
                overnight={causeLevel('us')}
                wind={causeLevel('fx')}
                samsung={isUnavailable ? null : causeLevel('samsung')}
                hynix={isUnavailable ? null : causeLevel('hynix')}
                fish={isUnavailable ? null : fish}
                focus={focus}
                onPick={pick}
                selected={picked ?? (reaction ? 'pori' : null)}
              />
            ) : (
            <Pori3D marketState={marketState} touchSignal={reactionTick} waterLevel={tradingActivity} volatility={volatility}
              foreignFlow={toFlowLevel(flows.foreign)}
              institutionFlow={toFlowLevel(flows.institution)}
              overnight={causeLevel('us')}
              wind={causeLevel('fx')}
              samsung={isUnavailable ? null : causeLevel('samsung')}
              hynix={isUnavailable ? null : causeLevel('hynix')}
              fish={isUnavailable ? null : fish}
              onPick={setPicked}
            />
            )}
          </Suspense>
          <span className="touch-hint">{SCENE_MODE === 'island' ? '섬을 끌어서 돌려보고, 눌러보세요!' : '포리와 주변을 눌러보세요!'}</span>
          {SCENE_MODE === 'sea' && (
          <button
            type="button"
            className={`pori-touch mode-3d ${reaction ? `reaction-${marketState}-${reactionTick % 2 ? 'a' : 'b'}` : ''}`}
            onClick={touchPori}
            aria-label="포리 쓰다듬기"
          >
            <span className="touch-particles" aria-hidden="true">
              <i>✦</i><i>♥</i><i>✦</i>
            </span>
          </button>
          )}
          {pickedInfo ? (
            <aside className="scene-info" aria-live="polite">
              <header>
                <span>{pickedInfo.title}</span>
                <b className={pickedInfo.tone}>{pickedInfo.value}</b>
                <button type="button" onClick={() => setPicked(null)} aria-label="설명 닫기">✕</button>
              </header>
              {pickedInfo.lines.map((line) => <p key={line}>{line}</p>)}
              {pickedInfo.news.length > 0 && (
                <ul>
                  {pickedInfo.news.map((item) => (
                    <li key={item.title}>
                      <span className={`sentiment ${item.sentiment}`}>{SENTIMENTS[item.sentiment]}</span>
                      <a href={item.sources[0].link} target="_blank" rel="noopener noreferrer">{item.title}</a>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          ) : (
            <div className={`speech ${reaction ? 'reacting' : ''}`} aria-live="polite">
              <strong>{reaction?.title ?? scenario.title}</strong>
              <span>{reaction?.message ?? scenario.message}</span>
              {SCENE_MODE === 'island' && !reaction && <small className="speech-place">포리는 지금 {PLACE_LINES[focus]}</small>}
            </div>
          )}
        </section>
      </main>

      <section className="demo-panel" aria-labelledby="demo-title">
        <div>
          <p className="eyebrow">상태 테스트</p>
          <h2 id="demo-title">가짜 데이터로 포리의 상태를 바꿔보세요</h2>
        </div>
        <div className="scenario-buttons" role="group" aria-label="시장 상태 선택">
          {Object.entries(DEMO_SCENARIOS).map(([key, item]) => (
            <button
              key={key}
              type="button"
              className={scenario.key === key ? 'active' : ''}
              onClick={() => selectDemoScenario(item)}
              aria-pressed={scenario.key === key}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
        <div className="data-contract">
          <span><b>marketState</b> {marketState}</span>
          <span><b>changeRate</b> {isUnavailable ? 'null' : scenario.changeRate}</span>
          <span><b>updatedAt</b> {scenario.updatedAt}</span>
        </div>
        <div className="turnover-control flow-control">
          {[['foreign', '외국인 배 (왼쪽, 산호색 돛)'], ['institution', '기관 배 (오른쪽, 파란 돛)']].map(([key, label]) => (
            <div key={key} className="flow-slider">
              <label htmlFor={`flow-${key}`}>
                <span>{label}</span>
                <strong>{formatFlow(flows[key])}</strong>
              </label>
              <input
                id={`flow-${key}`}
                type="range"
                min="-12000"
                max="12000"
                step="500"
                value={flows[key]}
                onChange={(event) => {
                  setFlows((current) => ({ ...current, [key]: Number(event.target.value) }))
                  setFlowMode('demo')
                }}
              />
            </div>
          ))}
          <div className="turnover-scale" aria-hidden="true">
            <span>팔고 떠나요</span><span>관망해요</span><span>짐 싣고 들어와요</span>
          </div>
        </div>
        <div className="turnover-control cause-control">
          <p className="cause-control-title">
            시장을 움직인 원인 <small>{causeMode === 'live' ? '실제값에서 시작' : '시연값'}</small>
          </p>
          {CAUSES.map(({ key, label, full, scale }) => (
            <div key={key} className="flow-slider">
              <label htmlFor={`cause-${key}`}>
                <span>{label}</span>
                <strong>{causes[key] > 0 ? '+' : ''}{causes[key].toFixed(1)}%</strong>
              </label>
              <input
                id={`cause-${key}`}
                type="range"
                min={-full * 1.2}
                max={full * 1.2}
                step={full / 25}
                value={causes[key]}
                onChange={(event) => {
                  setCauses((current) => ({ ...current, [key]: Number(event.target.value) }))
                  setCauseMode('demo')
                }}
              />
              <div className="turnover-scale" aria-hidden="true">
                {scale.map((text) => <span key={text}>{text}</span>)}
              </div>
            </div>
          ))}
        </div>
        <div className="turnover-control range-control">
          <label htmlFor="day-range">
            <span>변동성으로 파도 바꾸기</span>
            <strong>{dayRange.toFixed(1)}%</strong>
          </label>
          <input
            id="day-range"
            type="range"
            min="0.2"
            max="4"
            step="0.1"
            value={dayRange}
            onChange={(event) => {
              setDayRange(Number(event.target.value))
              setDayRangeMode('demo')
            }}
          />
          <div className="turnover-scale" aria-hidden="true">
            <span>잔잔해요</span><span>출렁여요</span><span>튜브가 필요해요</span>
          </div>
        </div>
        <div className="turnover-control">
          <label htmlFor="trading-value">
            <span>거래대금으로 물 높이 바꾸기</span>
            <strong>{(tradingValue / 1_000_000_000_000).toFixed(1)}조원</strong>
          </label>
          <input
            id="trading-value"
            type="range"
            min="2"
            max="25"
            step="1"
            value={tradingValue / 1_000_000_000_000}
            onChange={(event) => {
              setTradingValue(Number(event.target.value) * 1_000_000_000_000)
              setTradingValueMode('demo')
            }}
          />
          <div className="turnover-scale" aria-hidden="true">
            <span>한산해요</span><span>활발해요</span><span>아주 뜨거워요</span>
          </div>
        </div>
      </section>
      </>
      )}
    </div>
  )
}

export default App
