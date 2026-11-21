import { fetchNews } from '../server/news.js'

export default async function handler(_request, response) {
  try {
    const data = await fetchNews()
    response.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800')
    response.status(200).json(data)
  } catch (error) {
    response.status(502).json({
      error: 'NEWS_UNAVAILABLE',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
