import { fetchTrial } from '../server/trial.js'

export default async function handler(request, response) {
  try {
    const data = await fetchTrial(new URL(request.url, 'http://localhost').searchParams)
    response.setHeader('Cache-Control', 'no-store')
    response.status(200).json(data)
  } catch (error) {
    response.status(502).json({
      error: 'TRIAL_UNAVAILABLE',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
