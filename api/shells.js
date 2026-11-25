import { fetchShells } from '../server/trial.js'

export default async function handler(request, response) {
  try {
    const data = await fetchShells(new URL(request.url, 'http://localhost').searchParams)
    response.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900')
    response.status(200).json(data)
  } catch (error) {
    response.status(502).json({
      error: 'SHELLS_UNAVAILABLE',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
