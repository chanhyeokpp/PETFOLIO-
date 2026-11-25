import { fetchLetters } from '../server/letters.js'

export default async function handler(request, response) {
  try {
    const data = await fetchLetters(new URL(request.url, 'http://localhost').searchParams)
    response.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600')
    response.status(200).json(data)
  } catch (error) {
    response.status(502).json({
      error: 'LETTERS_UNAVAILABLE',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
