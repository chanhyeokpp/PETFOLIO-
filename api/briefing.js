import { fetchBriefing } from '../server/briefing.js'

export default async function handler(_request, response) {
  try {
    const data = await fetchBriefing()
    response.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600')
    response.status(200).json(data)
  } catch (error) {
    response.status(502).json({
      error: 'BRIEFING_UNAVAILABLE',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
