import { getProviderById, listProviders } from '../config/llmProviderLoader.js'

export interface PingResult {
  provider: string
  model: string
  status: 'ok' | 'fail'
  response?: string
  error?: string
  httpStatus?: number
  elapsedMs: number
}

export async function pingProvider(
  providerId: string,
  modelId?: string,
): Promise<PingResult> {
  const provider = getProviderById(providerId)
  if (!provider) {
    throw new Error(`Provider "${providerId}" not found`)
  }
  if (!provider.baseUrl) {
    return { provider: provider.name, model: '', status: 'fail', error: 'baseUrl not configured', elapsedMs: 0 }
  }
  if (!provider.apiKey) {
    return { provider: provider.name, model: '', status: 'fail', error: 'apiKey not configured', elapsedMs: 0 }
  }

  const testModel = modelId ?? provider.models[0]?.id
  const baseUrl = provider.baseUrl.replace(/\/+$/, '')
  const url = `${baseUrl}${provider.apiPath}`

  const body = {
    model: testModel,
    messages: [{ role: 'user' as const, content: 'ping' }],
    stream: false,
    max_tokens: 16,
    temperature: 0,
  }

  const started = Date.now()
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  const elapsed = Date.now() - started

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    return {
      provider: provider.name,
      model: testModel,
      status: 'fail',
      httpStatus: response.status,
      error: errText.slice(0, 500),
      elapsedMs: elapsed,
    }
  }

  const contentType = response.headers.get('content-type') ?? ''
  const raw = await response.text()

  let content = ''
  if (contentType.includes('text/event-stream') || raw.includes('data:')) {
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:') || trimmed === 'data: [DONE]') continue
      try {
        const chunk = JSON.parse(trimmed.slice(5).trim())
        const part =
          chunk.choices?.[0]?.delta?.content ??
          chunk.choices?.[0]?.message?.content ??
          ''
        content += part
      } catch { /* ignore */ }
    }
  } else {
    const data = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> }
    content = data.choices?.[0]?.message?.content ?? ''
  }

  return {
    provider: provider.name,
    model: testModel,
    status: 'ok',
    response: content.slice(0, 200),
    elapsedMs: elapsed,
  }
}

export async function pingAllProviders(): Promise<PingResult[]> {
  const providers = listProviders()
  const results: PingResult[] = []

  for (const p of providers) {
    const result = await pingProvider(p.id)
    results.push(result)
  }

  return results
}
