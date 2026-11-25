import { fetchBrokerCheck } from '../server/brokerCheck.js'

export default async function handler(request, response) {
  try {
    const data = await fetchBrokerCheck(new URL(request.url, 'http://localhost').searchParams)
    response.setHeader('Cache-Control', 'no-store')
    response.status(200).json(data)
  } catch (error) {
    response.status(502).json({
      error: 'BROKER_CHECK_UNAVAILABLE',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
