import { useState } from 'react'
import { buildFacts } from '../domain/facts'
import { CONFIDENCE, DEMO_NEWS, SCENE_TAGS, SENTIMENTS } from '../domain/news'

const RESULT_WORD = { rise: '상승', fall: '하락', flat: '보합' }

const formatTime = (iso) => new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(new Date(iso))

const sourceLabel = (sources) => {
  const outlets = [...new Set(sources.map((item) => item.source).filter(Boolean))]
  return outlets.length > 1 ? `${outlets[0]} 외 ${outlets.length - 1}곳` : outlets[0] ?? '기사 보기'
}

// 맞히기 보기 세 개: 정답(오늘의 범인)과, 오늘 실제로 일어난 일 가운데 그럴듯한 둘.
// 섬의 은유를 모르는 처음 온 사람도 고를 수 있게 쉬운 문장으로만 쓴다. 정답 자리는 날마다 바뀐다.
function buildChoices(culprit, footprints) {
  const plausible = (item) => (item.notable ? 2 : 0) + (item.agrees ? 1 : 0)
  const others = (footprints ?? [])
    .filter((item) => item.tag !== culprit.tag && item.statement)
    .sort((a, b) => plausible(b) - plausible(a))
    .slice(0, 2)
    .map((item) => ({ key: item.tag, text: item.statement, print: item }))
  const list = [{ key: 'culprit', text: `${culprit.title} 때문에` }, ...others]
  const shift = [...culprit.title].reduce((sum, char) => sum + char.charCodeAt(0), 0) % list.length
  return [...list.slice(shift), ...list.slice(0, shift)]
}

// 오늘 결과 한 줄: 원인을 묻기 전에 먼저 무엇이 일어났는지 보여준다.
function resultHeadline(changeRate) {
  if (!Number.isFinite(changeRate)) return '오늘 코스피는 어땠을까요?'
  const size = Math.abs(changeRate)
  if (size < 0.3) return `오늘 코스피는 거의 움직이지 않았어요 (${changeRate > 0 ? '+' : ''}${changeRate.toFixed(2)}%)`
  return `오늘 코스피가 ${size.toFixed(2)}% ${size >= 1.5 ? '크게 ' : ''}${changeRate > 0 ? '올랐어요' : '내렸어요'}`
}

// 받침이 있으면 "이었어요", 없으면 "였어요"
const wasIt = (word) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  return code >= 0 && code <= 11171 && code % 28 === 0 ? `${word}였어요` : `${word}이었어요`
}

// 맞히기 뒤에 보여줄 한두 문장. 점수나 기록은 남기지 않는다: 틀려도 배울 거리만 준다.
function guessFeedback(choice, culprit) {
  if (choice.key === 'culprit') return { tone: 'right', text: '맞혔어요! 기사들도 같은 걸 오늘의 원인으로 짚었어요.' }
  if (choice.print?.agrees && choice.print.notable) {
    return { tone: 'close', text: `그것도 오늘 실제로 일어난 일이에요(${choice.print.text}). 다만 기사들은 그보다 "${culprit.title}" 쪽을 더 큰 원인으로 봤어요.` }
  }
  return { tone: 'other', text: `이번엔 ${wasIt(culprit.title)}. 고른 쪽은 오늘 그렇게 크게 움직이지 않았어요(${choice.print?.text ?? ''}).` }
}

function Footprints({ footprints }) {
  if (!footprints?.length) return null
  return (
    <div className="case-block">
      <span className="case-label">숫자 발자국</span>
      <ul className="footprints">
        {footprints.map((item) => {
          const mark = !item.notable ? '잔잔' : item.agrees ? '같은 쪽' : '반대쪽'
          return (
            <li key={item.tag} className={`${item.notable ? '' : 'calm'} ${item.agrees ? 'agrees' : 'against'}`}>
              <span>{item.text}</span>
              <b>{mark}</b>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Suspects({ suspects, label }) {
  if (!suspects?.length) return null
  return (
    <div className="case-block">
      <span className="case-label">{label}</span>
      <ul className="suspects">
        {suspects.map((item) => (
          <li key={item.title}>
            <span>{item.title}</span>
            {item.outletCount > 0 && <small>언론사 {item.outletCount}곳</small>}
          </li>
        ))}
      </ul>
    </div>
  )
}

// 오늘의 범인 수사: 먼저 맞혀 보고(건너뛰기 가능) → 범인, 확신도, 숫자 발자국, 다른 용의자.
// 뚜렷한 범인이 없는 날은 억지로 만들지 않고 "안개 낀 날"로 보여준다.
function CulpritCase({ culprit, quietTitle, quietMessage, suspects, footprints, result, changeRate, marketState }) {
  // 범인이 없는 날은 맞히기 없이 바로 안개 카드
  const [guess, setGuess] = useState(culprit ? null : 'skipped')
  const choices = culprit ? buildChoices(culprit, footprints) : []

  if (guess === null) {
    return (
      <section className={`culprit-card guess-card ${marketState}`} aria-label="오늘의 범인 맞히기">
        <strong>{resultHeadline(changeRate)}</strong>
        <p>왜 그랬을 것 같아요? 맞혀도 틀려도 기록은 남지 않아요.</p>
        <div className="guess-list">
          {choices.map((choice) => (
            <button key={choice.key} type="button" className="guess-choice" onClick={() => setGuess(choice)}>
              {choice.text}
            </button>
          ))}
        </div>
        <button type="button" className="text-button guess-skip" onClick={() => setGuess('skipped')}>잘 모르겠어요, 바로 볼래요</button>
      </section>
    )
  }

  const feedback = guess === 'skipped' ? null : guessFeedback(guess, culprit)
  const confidence = culprit ? CONFIDENCE[culprit.confidence] : null
  return (
    <>
      {feedback && <p className={`guess-feedback ${feedback.tone}`} role="status">{feedback.text}</p>}
      {culprit ? (
        <section className={`culprit-card ${marketState}`} aria-label="오늘의 범인">
          <div className="culprit-head">
            <span className="culprit-label">오늘의 범인</span>
            {confidence && <span className={`confidence ${culprit.confidence}`} title={confidence.note}>{confidence.label}</span>}
          </div>
          <strong>{culprit.title}</strong>
          {culprit.summary && <p>{culprit.summary}</p>}
          <ol className="cause-chain">
            {[...(culprit.chain ?? []), result].filter(Boolean).map((step) => <li key={step}>{step}</li>)}
          </ol>
          {confidence && <p className="confidence-note">{confidence.note}</p>}
          <Footprints footprints={footprints} />
          <Suspects suspects={suspects} label="다른 용의자" />
          {culprit.sources?.length > 0 && (
            <p className="culprit-note">
              언론사 {culprit.outletCount}곳의 기사 제목이 이 원인을 말했어요.{' '}
              {culprit.sources.map((item, index) => (
                <span key={item.link}>
                  {index > 0 && ' · '}
                  <a href={item.link} target="_blank" rel="noopener noreferrer">{item.source || '기사'}</a>
                </span>
              ))}
            </p>
          )}
        </section>
      ) : (
        <section className="culprit-card quiet fog-card" aria-label="안개 낀 날">
          <span className="culprit-label">안개 낀 날</span>
          <strong>{quietTitle ?? '뚜렷한 범인이 없는 날이에요'}</strong>
          <p>{quietMessage}</p>
          <p className="confidence-note">시장은 뚜렷한 이유 없이도 움직여요. 이런 날 억지로 이유를 붙이지 않는 것도 시장을 읽는 힘이에요.</p>
          <Footprints footprints={footprints} />
          <Suspects suspects={suspects} label="기사에 나온 후보" />
        </section>
      )}
    </>
  )
}

// 기사 제목들에서 LLM이 뽑은 범인과 소식. 범인 옆에 숫자 검증 결과를 함께 보여준다.
function AiBriefing({ briefing, marketState, changeRate, characterName }) {
  const { culprit, items } = briefing
  const result = `코스피 ${changeRate > 0 ? '+' : ''}${changeRate.toFixed(2)}% ${RESULT_WORD[marketState] ?? ''}`.trim()
  return (
    <>
      <CulpritCase
        culprit={culprit} quietMessage={briefing.quietMessage} suspects={briefing.suspects} footprints={briefing.footprints}
        result={result} changeRate={changeRate} marketState={marketState}
      />

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
      <CulpritCase
        culprit={briefing.culprit} quietTitle={briefing.quietTitle} quietMessage={briefing.quietMessage}
        suspects={briefing.suspects} footprints={briefing.footprints}
        result={result} changeRate={changeRate} marketState={marketState}
      />

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

export default function NewsBriefing({ marketState, changeRate, characterName, isLive, flows, drivers, news, briefing, nextLetter, onDone }) {
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

      {nextLetter && (
        <p className="next-letter">
          <span aria-hidden="true">🍾</span> 수평선에 병편지가 떠 있어요.{' '}
          <b>{nextLetter.dday === 0 ? '오늘' : nextLetter.dday === 1 ? '내일' : `${nextLetter.dday}일 뒤`} {nextLetter.title}</b>
          {' '}· 섬에서 병을 눌러 보세요
        </p>
      )}
      <button type="button" className="primary-button" onClick={onDone}>{characterName} 보러 가기</button>
    </main>
  )
}
