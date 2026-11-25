import { useState } from 'react'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const formatDate = (day) => {
  const [year, month, date] = day.split('-').map(Number)
  return `${month}/${date}(${WEEKDAYS[new Date(Date.UTC(year, month - 1, date)).getUTCDay()]})`
}
const ddayLabel = (dday) => (dday === 0 ? '오늘' : dday === 1 ? '내일' : `D-${dday}`)

// 편지 한 통: 무엇을 알게 되나 한 줄, 이번엔(시장 예상) 한 줄, 두 갈래. 그 밖의 글은 두지 않는다.
function Letter({ letter, open, onToggle }) {
  const source = letter.expectation?.sources?.[0]
  return (
    <li className={`letter ${open ? 'open' : ''}`}>
      <button type="button" className="letter-head" onClick={onToggle} aria-expanded={open}>
        <span className="letter-capsule">{letter.title}</span>
        <span className="letter-when">
          <b className={letter.dday <= 1 ? 'soon' : ''}>{ddayLabel(letter.dday)}</b>
          <small>{formatDate(letter.kstDate)}</small>
        </span>
      </button>
      {/* 늘 그려 두고 높이만 접었다 폈다: 바뀔 때 부드럽게 */}
      <div className="letter-fold" inert={!open} aria-hidden={!open}>
        <div className="letter-clip">
          <div className="letter-body">
            {/* 제목이 무엇인지 풀어 주는 말풍선: 꼬리가 캡슐을 가리킨다 */}
            <p className="letter-watch">{letter.watch}</p>
            {letter.expectation && (
              <p className="letter-expect">
                <b>이번엔</b>
                <span>{letter.expectation.text}{letter.expectation.figure && <em>{letter.expectation.figure}</em>}</span>
                {source?.link && (
                  <a href={source.link} target="_blank" rel="noopener noreferrer" title={source.source}>기사 ↗</a>
                )}
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
          </div>
        </div>
      </div>
    </li>
  )
}

// 수평선 병편지: 시장이 기다리는 일정. 예측이 아니라 "무엇을 보게 되는지"를 미리 알려준다.
export default function LetterPanel({ letters, onClose }) {
  const upcoming = letters?.upcoming ?? []
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
    </aside>
  )
}
