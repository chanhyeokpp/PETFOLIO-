export function getMarketState(changeRate) {
  if (typeof changeRate !== 'number' || Number.isNaN(changeRate)) return 'error'
  if (changeRate > 0) return 'rise'
  if (changeRate < 0) return 'fall'
  return 'flat'
}

export const DEMO_SCENARIOS = {
  rise: {
    key: 'rise', label: '상승', icon: '☀️', weather: '☀️',
    kospiValue: 2678.42, changeRate: 1.45, updatedAt: '15:30',
    title: '포리가 신났어요!', message: '시장이 어제보다 올랐어요.',
  },
  flat: {
    key: 'flat', label: '보합', icon: '⛅', weather: '⛅',
    kospiValue: 2640.18, changeRate: 0, updatedAt: '15:30',
    title: '오늘은 잔잔해요', message: '시장이 어제와 비슷해요.',
  },
  fall: {
    key: 'fall', label: '하락', icon: '🌧️', weather: '🌧️',
    kospiValue: 2598.71, changeRate: -1.18, updatedAt: '15:30',
    title: '포리가 시무룩해요', message: '시장이 어제보다 내렸어요.',
  },
  closed: {
    key: 'closed', state: 'closed', label: '휴장', icon: '🌙', weather: '🌙',
    kospiValue: 2640.18, changeRate: 0, updatedAt: '휴장일',
    title: '오늘은 쉬는 날이에요', message: '포리가 쿨쿨 자고 있어요.',
  },
  loading: {
    key: 'loading', state: 'loading', label: '로딩', icon: '⌛', weather: '⏳',
    changeRate: null, updatedAt: '확인 중',
    title: '시장을 살펴보는 중', message: '잠시만 기다려 주세요.',
  },
  error: {
    key: 'error', state: 'error', label: '오류', icon: '⚠️', weather: '💨',
    changeRate: null, updatedAt: '연결 실패',
    title: '앗, 잠시 문제가 생겼어요', message: '조금 뒤 다시 확인해 주세요.',
  },
}
