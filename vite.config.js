import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { fetchBriefing } from './server/briefing.js'
import { fetchKospi } from './server/kospi.js'
import { fetchNews } from './server/news.js'

const API_ROUTES = {
  '/api/kospi': { load: fetchKospi, error: 'MARKET_DATA_UNAVAILABLE' },
  '/api/news': { load: fetchNews, error: 'NEWS_UNAVAILABLE' },
  '/api/briefing': { load: fetchBriefing, error: 'BRIEFING_UNAVAILABLE' },
}

// .env.local의 서버용 키(OPENAI_API_KEY, KRX_AUTH_KEY)를 API 코드가 읽을 수 있게 한다.
// VITE_ 접두사가 없어서 브라우저 코드에는 들어가지 않는다.
for (const [key, value] of Object.entries(loadEnv('development', process.cwd(), ['OPENAI_', 'KRX_']))) {
  process.env[key] ??= value
}

function kospiApi() {
  const middleware = async (request, response, next) => {
    const route = API_ROUTES[request.url?.split('?')[0]]
    if (!route) {
      next()
      return
    }

    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.setHeader('Cache-Control', 'no-store')

    try {
      response.statusCode = 200
      response.end(JSON.stringify(await route.load()))
    } catch (error) {
      response.statusCode = 502
      response.end(JSON.stringify({
        error: route.error,
        message: error instanceof Error ? error.message : 'Unknown error',
      }))
    }
  }

  return {
    name: 'petfolio-kospi-api',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [kospiApi(), react()],
})
