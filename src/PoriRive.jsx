import { useEffect } from 'react'
import {
  useRive,
  useViewModelInstanceEnum,
  useViewModelInstanceNumber,
  useViewModelInstanceString,
  useViewModelInstanceTrigger,
} from '@rive-app/react-webgl2'

export default function PoriRive({ marketState, changeRate, kospiValue, updatedAt, touchSignal }) {
  const { rive, RiveComponent } = useRive({
    src: '/pori.riv',
    artboard: 'PoriMarket',
    stateMachine: 'MarketStateMachine',
    autoplay: true,
    autoBind: true,
  })

  const viewModelInstance = rive?.viewModelInstance
  const { setValue: setMarketState } = useViewModelInstanceEnum(
    'marketState',
    viewModelInstance,
  )
  const { setValue: setChangeRate } = useViewModelInstanceNumber(
    'changeRate',
    viewModelInstance,
  )
  const { setValue: setKospiValue } = useViewModelInstanceNumber(
    'kospiValue',
    viewModelInstance,
  )
  const { setValue: setUpdatedAt } = useViewModelInstanceString(
    'updatedAt',
    viewModelInstance,
  )
  const { trigger: triggerTouchReaction } = useViewModelInstanceTrigger(
    'touchReaction',
    viewModelInstance,
  )

  useEffect(() => {
    setMarketState(marketState)
    setChangeRate(Number.isFinite(changeRate) ? changeRate : 0)
    setKospiValue(Number.isFinite(kospiValue) ? kospiValue : 0)
    setUpdatedAt(updatedAt)
  }, [
    marketState,
    changeRate,
    kospiValue,
    updatedAt,
    setMarketState,
    setChangeRate,
    setKospiValue,
    setUpdatedAt,
  ])

  useEffect(() => {
    if (touchSignal > 0) triggerTouchReaction()
  }, [touchSignal, triggerTouchReaction])

  return (
    <RiveComponent
      className="pori-rive"
      aria-label={`금융 펫 포리의 현재 상태: ${marketState}`}
    />
  )
}
