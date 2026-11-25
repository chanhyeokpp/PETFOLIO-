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
          <p className="letter-when">{letter.timeNote}</p>
          <p><b>무엇을 알게 되나요?</b> {letter.watch}</p>
          {letter.expectation && (
            <p className="letter-expect">
              <b>이번엔</b> {letter.expectation.text}
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
            {letter.branches.map((branch) => (
              <div key={branch.when}>
                <b>{branch.when}</b>
                <p>{branch.then}</p>
              </div>
            ))}
          </div>
          <p className="letter-places">
            섬에서 볼 곳:{' '}
            {letter.island.map((key) => placeOf(key)).filter(Boolean).map((place) => (
              <span key={place.key}>{place.icon} {place.label}</span>
            ))}
          </p>
          <p className="letter-note">{letter.note}</p>
          <a className="letter-source" href={letter.source.url} target="_blank" rel="noopener noreferrer">일정 출처: {letter.source.name}</a>
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
          {formatDate(letter.reply.day)} 코스피 <em className={letter.reply.changeRate < 0 ? 'down' : 'up'}>{signed(letter.reply.changeRate)}</em>, 그날의 범인은 <b>{letter.reply.title}</b>.{' '}
          {related
            ? '편지에 적힌 곳에서 범인이 나왔어요.'
            : '그날 바다를 흔든 건 다른 곳이었어요. 일정이 있다고 꼭 그날의 범인이 되는 건 아니에요.'}
        </p>
      ) : (
        <p className="letter-reply">답장은 장이 열리고 그날 기록이 쌓이면 와요.</p>
      )}
    </li>
  )
}

// 수평선 병편지: 시장이 기다리는 일정. 예측이 아니라 "무엇을 보게 되는지"를 미리 알려준다.
export default function LetterPanel({ letters, onClose }) {
  const upcoming = letters?.upcoming ?? []
  const past = letters?.past ?? []
  const [openId, setOpenId] = useState(upcoming[0]?.id ?? null)
  return (
    <aside className="shell-chest letter-panel" aria-label="수평선 병편지">
      <header>
        <strong>수평선 병편지</strong>
        <span>{upcoming.length}통</span>
        <button type="button" onClick={onClose} aria-label="병편지 닫기">✕</button>
      </header>
      <p className="shell-note">시장이 기다리는 일정이 수평선에서 떠내려와요. 무엇이 오를지 맞히는 게 아니라, 그날 무엇을 보게 되는지 미리 알려 드려요.</p>
      {letters === undefined && <p className="shell-note">포리가 편지를 건져 오는 중이에요…</p>}
      {letters === null && <p className="shell-note">편지를 가져오지 못했어요.</p>}
      {upcoming.length > 0 && (
        <ol className="letters">
          {upcoming.map((letter) => (
            <Letter
              key={letter.id} letter={letter} open={openId === letter.id}
              onToggle={() => setOpenId((current) => (current === letter.id ? null : letter.id))}
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
