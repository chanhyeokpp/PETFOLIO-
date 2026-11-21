export default function WaterBackground({ activity }) {
  const normalized = Math.min(1, Math.max(0.08, activity ?? 0.55))

  return (
    <div
      className="water-level"
      style={{ '--water-height': `${Math.round(normalized * 100)}%` }}
      aria-hidden="true"
    >
      <div className="water-surface water-surface-back" />
      <div className="water-surface water-surface-front" />
      <span className="bubble bubble-one" />
      <span className="bubble bubble-two" />
      <span className="bubble bubble-three" />
    </div>
  )
}
