import { fetchStockNews } from '../server/stockNews.js'

export default async function handler(request, response) {
  try {
    const data = await fetchStockNews(new URL(request.url, 'http://localhost').searchParams)
    response.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800')
    response.status(200).json(data)
  } catch (error) {
    response.status(502).json({
      error: 'STOCK_NEWS_UNAVAILABLE',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
