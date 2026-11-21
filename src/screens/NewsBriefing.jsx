import { buildFacts } from '../domain/facts'
import { DEMO_NEWS, SCENE_TAGS, SENTIMENTS } from '../domain/news'

const RESULT_WORD = { rise: '상승', fall: '하락', flat: '보합' }

const formatTime = (iso) => new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(new Date(iso))

const sourceLabel = (sources) => {
  const outlets = [...new Set(sources.map((item) => item.source).filter(Boolean))]
  return outlets.length > 1 ? `${outlets[0]} 외 ${outlets.length - 1}곳` : outlets[0] ?? '기사 보기'
}

// 기사 제목들에서 LLM이 뽑은 범인과 소식. 범인 옆에 숫자 검증 결과를 함께 보여준다.
function AiBriefing({ briefing, marketState, changeRate, characterName }) {
  const { culprit, items } = briefing
  const result = `코스피 ${changeRate > 0 ? '+' : ''}${changeRate.toFixed(2)}% ${RESULT_WORD[marketState] ?? ''}`.trim()
  return (
    <>
      {culprit ? (
        <section className={`culprit-card ${marketState}`} aria-label="오늘의 범인">
          <span className="culprit-label">오늘의 범인</span>
          <strong>{culprit.title}</strong>
          {culprit.summary && <p>{culprit.summary}</p>}
          <ol className="cause-chain">
            {[...culprit.chain, result].map((step) => <li key={step}>{step}</li>)}
          </ol>
          {culprit.check && (
            <p className={`culprit-check ${culprit.check.status}`}>
              {culprit.check.status === 'supported' ? '숫자도 같은 얘기를 해요: ' : '숫자로 보면: '}
              {culprit.check.note}
            </p>
          )}
          <p className="culprit-note">
            언론사 {culprit.outletCount}곳의 기사 제목이 이 원인을 말했어요.{' '}
            {culprit.sources.map((item, index) => (
              <span key={item.link}>
                {index > 0 && ' · '}
                <a href={item.link} target="_blank" rel="noopener noreferrer">{item.source || '기사'}</a>
              </span>
            ))}
          </p>
        </section>
      ) : (
        <section className="culprit-card quiet">
          <span className="culprit-label">오늘의 범인</span>
          <strong>뚜렷한 범인이 없는 날이에요</strong>
          <p>{briefing.quietMessage}</p>
        </section>
      )}

      <div className="news-list-head">
        <h2>알아둘 소식 {items.length}개</h2>
        <span className="source-count">기사 제목 {briefing.headlineCount}건을 AI가 읽고 정리했어요</span>
      </div>
      <ol className="news-list">
        {items.map((item, index) => {
          const tag = SCENE_TAGS[item.tag] ?? SCENE_TAGS.other
          return (
            <li key={item.title} className="news-card">
              <span className="news-number" aria-hidden="true">{index + 1}</span>
              <div className="news-body">
                <div className="news-tags">
                  <span className="news-tag"><span aria-hidden="true">{tag.icon}</span> {tag.label}</span>
                  <span className={`sentiment ${item.sentiment}`}>{SENTIMENTS[item.sentiment]}</span>
                </div>
                <strong>{item.title}</strong>
                <p>{item.summary}</p>
                <a className="news-origin" href={item.sources[0].link} target="_blank" rel="noopener noreferrer">
                  출처: {sourceLabel(item.sources)}
                </a>
                {tag.ready && <small className="scene-hint">{characterName} 화면의 <b>{tag.scene}</b>에서 확인할 수 있어요</small>}
              </div>
            </li>
          )
        })}
      </ol>
    </>
  )
}

// LLM 결과가 아직 없거나 만들 수 없을 때: 숫자로 확인되는 사실 + 언론사 마감 기사 제목.
function LiveBriefing({ marketState, changeRate, flows, drivers, news, isThinking, characterName }) {
  const facts = buildFacts({ changeRate, flows, drivers })
  return (
    <>
      <section className={`culprit-card ${marketState}`} aria-label="오늘 움직인 것">
        <span className="culprit-label">오늘 움직인 것</span>
        <strong>코스피가 {Math.abs(changeRate).toFixed(2)}% {RESULT_WORD[marketState] === '보합' ? '움직였어요' : `${RESULT_WORD[marketState]}했어요`}</strong>
        <ul className="fact-list">
          {facts.filter((fact) => !fact.main).map((fact) => (
            <li key={fact.key}>
              <span>{fact.label}</span>
              <b>{fact.value}</b>
              {fact.note && <small>{fact.note}</small>}
            </li>
          ))}
        </ul>
        <p className="culprit-note">
          {isThinking
            ? `${characterName}가 기사를 읽고 오늘의 범인을 찾는 중이에요…`
            : '숫자로 확인되는 사실만 모았어요. 왜 그랬는지는 아래 기사 제목에서 볼 수 있어요.'}
        </p>
      </section>

      <div className="news-list-head">
        <h2>주요 마감 기사 {news.items.length}개</h2>
        <span className="source-count">기사 {news.collectedCount}건 · 언론사 {news.outletCount}곳에서 골랐어요</span>
      </div>
      <ol className="news-list">
        {news.items.map((item, index) => (
          <li key={item.link} className="news-card">
            <span className="news-number" aria-hidden="true">{index + 1}</span>
            <div className="news-body">
              <span className="news-source">{item.source}{item.publishedAt && ` · ${formatTime(item.publishedAt)}`}</span>
              <a href={item.link} target="_blank" rel="noopener noreferrer">{item.title}</a>
            </div>
          </li>
        ))}
      </ol>
    </>
  )
}

// 예시 데이터: 상태 테스트 모드이거나 실제 기사를 못 가져왔을 때.
function SampleBriefing({ briefing, marketState, changeRate, characterName }) {
  const result = Number.isFinite(changeRate) && RESULT_WORD[marketState]
    ? `코스피 ${changeRate > 0 ? '+' : ''}${changeRate.toFixed(2)}% ${RESULT_WORD[marketState]}`
    : null
  return (
    <>
      {briefing.culprit ? (
        <section className={`culprit-card ${marketState}`} aria-label="오늘의 범인">
          <span className="culprit-label">오늘의 범인</span>
          <strong>{briefing.culprit.title}</strong>
          <ol className="cause-chain">
            {[...briefing.culprit.chain, result].filter(Boolean).map((step) => <li key={step}>{step}</li>)}
          </ol>
        </section>
      ) : (
        <section className="culprit-card quiet">
          <span className="culprit-label">오늘의 범인</span>
          <strong>{briefing.quietTitle}</strong>
          <p>{briefing.quietMessage}</p>
        </section>
      )}

      <div className="news-list-head">
        <h2>알아둘 소식 {briefing.items.length}개</h2>
        <span className="sample-badge">예시 뉴스 · 실제 기사 아님</span>
      </div>
      <ol className="news-list">
        {briefing.items.map((item, index) => {
          const tag = SCENE_TAGS[item.tag]
          return (
            <li key={item.id} className="news-card">
              <span className="news-number" aria-hidden="true">{index + 1}</span>
              <div className="news-body">
                <div className="news-tags">
                  <span className="news-tag"><span aria-hidden="true">{tag.icon}</span> {tag.label}</span>
                  <span className={`sentiment ${item.sentiment}`}>{SENTIMENTS[item.sentiment]}</span>
                </div>
                <strong>{item.title}</strong>
                <p>{item.summary}</p>
                {tag.ready && <small className="scene-hint">{characterName} 화면의 <b>{tag.scene}</b>에서 확인할 수 있어요</small>}
              </div>
            </li>
          )
        })}
      </ol>
    </>
  )
}

export default function NewsBriefing({ marketState, changeRate, characterName, isLive, flows, drivers, news, briefing, onDone }) {
  const sample = DEMO_NEWS[marketState]
  const isLoading = marketState === 'loading' || (isLive && news === undefined)
  const hasLiveNews = isLive && news?.items?.length > 0 && Number.isFinite(changeRate) && marketState !== 'closed'
  const hasAiBriefing = hasLiveNews && Boolean(briefing) && (briefing.culprit || briefing.items.length > 0)

  return (
    <main className="screen news-screen">
      <header className="news-header">
        <div>
          <p className="eyebrow">오늘의 시황</p>
          <h1 className="screen-title">{characterName}를 만나기 전에,<br />오늘 있었던 일부터 볼까요?</h1>
        </div>
        <button type="button" className="text-button" onClick={onDone}>건너뛰기</button>
      </header>

      {isLoading && (
        <section className="culprit-card quiet">
          <strong>{characterName}가 오늘 소식을 모으는 중이에요</strong>
          <p>잠시만 기다려 주세요.</p>
        </section>
      )}
      {!isLoading && hasAiBriefing && (
        <AiBriefing briefing={briefing} marketState={marketState} changeRate={changeRate} characterName={characterName} />
      )}
      {!isLoading && hasLiveNews && !hasAiBriefing && (
        <LiveBriefing
          marketState={marketState} changeRate={changeRate} flows={flows} drivers={drivers} news={news}
          isThinking={briefing === undefined} characterName={characterName}
        />
      )}
      {!isLoading && !hasLiveNews && sample && (
        <SampleBriefing briefing={sample} marketState={marketState} changeRate={changeRate} characterName={characterName} />
      )}
      {!isLoading && !hasLiveNews && !sample && (
        <section className="culprit-card quiet">
          <strong>오늘 소식을 가져오지 못했어요</strong>
          <p>바로 {characterName}를 만나러 가도 괜찮아요.</p>
        </section>
      )}

      <button type="button" className="primary-button" onClick={onDone}>{characterName} 보러 가기</button>
    </main>
  )
}
