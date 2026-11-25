// OpenAI에 JSON 스키마로 답을 받는 공용 호출. 키는 서버 환경변수에만 있다.
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const DEFAULT_MODEL = 'gpt-5-mini'

export const objectSchema = (properties, required = Object.keys(properties)) => ({
  type: 'object', properties, required, additionalProperties: false,
})

export async function askJson({ apiKey, system, user, name, schema, timeoutMs = 60_000 }) {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      reasoning_effort: 'low',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new Error(`LLM request failed: ${response.status} ${detail?.error?.message ?? ''}`.trim())
  }
  const payload = await response.json()
  return JSON.parse(payload.choices[0].message.content)
}
