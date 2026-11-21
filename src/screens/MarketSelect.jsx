import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { MARKETS } from '../domain/markets'

const Pori3D = lazy(() => import('../Pori3D'))

const SWIPE_DISTANCE = 40

// position of a card relative to the centred one, wrapped to -1 / 0 / 1 ...
function getOffset(index, active, count) {
  let offset = (index - active) % count
  if (offset > count / 2) offset -= count
  if (offset < -count / 2) offset += count
  return offset
}

export default function MarketSelect({ initialId, onConfirm }) {
  const [active, setActive] = useState(() => Math.max(0, MARKETS.findIndex((item) => item.id === initialId)))
  const swipeStart = useRef(null)
  const count = MARKETS.length
  const current = MARKETS[active]
  const turn = (step) => setActive((index) => (index + step + count) % count)

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'ArrowLeft') setActive((index) => (index - 1 + count) % count)
      if (event.key === 'ArrowRight') setActive((index) => (index + 1) % count)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [count])

  const endSwipe = (event) => {
    if (swipeStart.current === null) return
    const distance = event.clientX - swipeStart.current
    swipeStart.current = null
    if (Math.abs(distance) >= SWIPE_DISTANCE) turn(distance < 0 ? 1 : -1)
  }

  return (
    <main className="screen select-screen">
      <p className="eyebrow">시장 고르기</p>
      <h1 className="screen-title">어느 시장을 만나볼까요?</h1>

      <div
        className="carousel"
        onPointerDown={(event) => { swipeStart.current = event.clientX }}
        onPointerUp={endSwipe}
        onPointerCancel={() => { swipeStart.current = null }}
      >
        <button type="button" className="carousel-arrow prev" onClick={() => turn(-1)} aria-label="이전 시장">‹</button>
        <div className="carousel-track">
          {MARKETS.map((item, index) => {
            const offset = getOffset(index, active, count)
            const centred = offset === 0
            return (
              <div
                key={item.id}
                className={`market-pick ${item.id} ${centred ? 'centred' : 'side'} ${item.available ? '' : 'locked'}`}
                style={{ '--offset': offset }}
                onClick={centred ? undefined : () => setActive(index)}
                aria-hidden={!centred}
              >
                <span className="market-pick-name">{item.name}</span>
                <div className="market-pick-figure">
                  {item.available ? (
                    <Suspense fallback={null}>
                      <Pori3D marketState="flat" touchSignal={0} solo />
                    </Suspense>
                  ) : (
                    <span className="silhouette" aria-hidden="true"><i /><i /><b>?</b></span>
                  )}
                </div>
                <span className="market-pick-market">{item.market}</span>
                {!item.available && <span className="market-pick-soon">준비 중</span>}
              </div>
            )
          })}
        </div>
        <button type="button" className="carousel-arrow next" onClick={() => turn(1)} aria-label="다음 시장">›</button>
      </div>

      <div className="carousel-dots" aria-hidden="true">
        {MARKETS.map((item, index) => <i key={item.id} className={index === active ? 'on' : ''} />)}
      </div>

      <p className="select-description" aria-live="polite">
        <strong>{current.market}</strong>
        {current.description}
      </p>
      <button
        type="button"
        className="primary-button"
        disabled={!current.available}
        onClick={() => onConfirm(current.id)}
      >
        {current.available ? `${current.name}와 시작하기` : '아직 준비 중이에요'}
      </button>
    </main>
  )
}
