import { useState } from 'react'
import { GUESS_CHOICES } from './domain/news'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const formatDate = (day) => {
  const [year, month, date] = day.split('-').map(Number)
  return `${month}/${date}(${WEEKDAYS[new Date(Date.UTC(year, month - 1, date)).getUTCDay()]})`
}
const ddayLabel = (dday) => (dday === 0 ? '오늘' : dday === 1 ? '내일' : `D-${dday}`)
const placeOf = (key) => GUESS_CHOICES.find((choice) => choice.key === key)
const signed = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`

function Letter({ letter, open, onToggle }) {
  return (
    <li className={`letter ${open ? 'open' : ''}`}>
      <button type="button" className="letter-head" onClick={onToggle} aria-expanded={open}>
        <b className={letter.dday <= 1 ? 'soon' : ''}>{ddayLabel(letter.dday)}</b>
        <span>{letter.title}</span>
        <small>{formatDate(letter.kstDate)}</small>
      </button>
      {open && (
        <div className="letter-body">
          <p className="letter-watch">{letter.watch} <small>{letter.timeNote}</small></p>
          {letter.expectation && (
            <p className="letter-expect">
              <b>이번엔</b>
              <span>{letter.expectation.text}{letter.expectation.figure && <em>{letter.expectation.figure}</em>}</span>
              <small>
                {letter.expectation.sources.map((source, index) => (
                  <span key={source.link}>
                    {index > 0 && ' · '}
                    <a href={source.link} target="_blank" rel="noopener noreferrer">{source.source || '기사'}</a>
                  </span>
                ))}
              </small>
            </p>
          )}
          <div className="letter-branches">
            {letter.branches.map((branch, index) => (
              <div key={branch.when} className={index === 0 ? 'low' : 'high'}>
                <b><i aria-hidden="true">{index === 0 ? '▼' : '▲'}</i>{branch.when}</b>
                <p>{branch.then}</p>
              </div>
            ))}
          </div>
          <p className="letter-foot">
            섬에서 볼 곳: {letter.island.map((key) => placeOf(key)?.label).filter(Boolean).join(' · ')} · {letter.note}{' '}
            <a href={letter.source.url} target="_blank" rel="noopener noreferrer">일정 출처</a>
          </p>
        </div>
      )}
    </li>
  )
}

// 일정이 지나면 그 뒤 첫 거래일 기록이 답장으로 온다. 일정이 꼭 그날의 범인이 되지는 않는다는 걸 보여준다.
function Reply({ letter }) {
  const places = letter.island.map((key) => placeOf(key)).filter(Boolean)
  const related = letter.reply && places.some((place) => place.tags.includes(letter.reply.tag))
  return (
    <li className="letter replied">
      <div className="letter-head static">
        <b>답장</b>
        <span>{letter.title}</span>
        <small>{formatDate(letter.kstDate)}</small>
      </div>
      {letter.reply ? (
        <p className="letter-reply">
          {formatDate(letter.reply.day)} 코스피 <em className={letter.reply.changeRate < 0 ? 'down' : 'up'}>{signed(letter.reply.changeRate)}</em> · 범인: <b>{letter.reply.title}</b>
          <span className={`reply-tag ${related ? 'hit' : ''}`}>{related ? '편지에 적힌 곳에서 나왔어요' : '다른 곳에서 나왔어요'}</span>
        </p>
      ) : (
        <p className="letter-reply">장이 열리면 답장이 와요.</p>
      )}
    </li>
  )
}

// 수평선 병편지: 시장이 기다리는 일정. 예측이 아니라 "무엇을 보게 되는지"를 미리 알려준다.
export default function LetterPanel({ letters, onClose }) {
  const upcoming = letters?.upcoming ?? []
  const past = letters?.past ?? []
  // undefined = 아직 아무것도 안 고름 → 가장 가까운 편지를 펼쳐 둔다 (편지가 늦게 와도)
  const [chosenId, setOpenId] = useState(undefined)
  const openId = chosenId === undefined ? upcoming[0]?.id ?? null : chosenId
  return (
    <aside className="shell-chest letter-panel" aria-label="수평선 병편지">
      <header>
        <strong>수평선 병편지</strong>
        <span>{upcoming.length}통</span>
        <button type="button" onClick={onClose} aria-label="병편지 닫기">✕</button>
      </header>
      <p className="shell-note">무엇이 오를지가 아니라, 그날 무엇을 보게 되는지 알려 드려요.</p>
      {letters === undefined && <p className="shell-note">포리가 편지를 건져 오는 중이에요…</p>}
      {letters === null && <p className="shell-note">편지를 가져오지 못했어요.</p>}
      {upcoming.length > 0 && (
        <ol className="letters">
          {upcoming.map((letter) => (
            <Letter
              key={letter.id} letter={letter} open={openId === letter.id}
              onToggle={() => setOpenId(openId === letter.id ? null : letter.id)}
            />
          ))}
        </ol>
      )}
      {past.length > 0 && (
        <>
          <h3 className="letters-title">지난 편지</h3>
          <ol className="letters">
            {past.map((letter) => <Reply key={letter.id} letter={letter} />)}
          </ol>
        </>
      )}
    </aside>
  )
}
