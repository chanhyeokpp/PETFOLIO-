import { fetchKospi } from '../server/kospi.js'

export default async function handler(_request, response) {
  try {
    const data = await fetchKospi()
    response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    response.status(200).json(data)
  } catch (error) {
    response.status(502).json({
      error: 'MARKET_DATA_UNAVAILABLE',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
