// One character per market. Only Pori (KOSPI) is playable for now.
export const MARKETS = [
  {
    id: 'kospi',
    name: '포리',
    market: '국장 · KOSPI',
    world: '물가',
    description: '물가에 사는 수달 포리가 오늘 코스피의 분위기를 보여줘요.',
    available: true,
  },
  {
    id: 'us',
    name: '???',
    market: '미장',
    world: '하늘',
    description: '하늘에 사는 친구가 미국 증시를 준비하고 있어요.',
    available: false,
  },
  {
    id: 'crypto',
    name: '???',
    market: '크립토',
    world: '우주',
    description: '우주에 사는 친구가 크립토 시장을 준비하고 있어요.',
    available: false,
  },
]

export const getMarket = (id) => MARKETS.find((item) => item.id === id) ?? null
