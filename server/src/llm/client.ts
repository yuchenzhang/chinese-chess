import type { ChatMessage } from '../routes/ai.js'

export interface AiMoveResponse {
  move: string
  rawContent?: string
}

export async function callLlmForMove(
  providerId: string,
  modelId: string,
  messages: ChatMessage[],
): Promise<AiMoveResponse> {
  const { getProviderById } = await import('../config/llmProviderLoader.js')
  const provider = getProviderById(providerId)
  if (!provider) {
    throw new Error(`Provider "${providerId}" not found in config`)
  }
  if (!provider.baseUrl) {
    throw new Error(`Provider "${provider.name}" has no baseUrl configured`)
  }
  if (!provider.apiKey) {
    throw new Error(`Provider "${provider.name}" has no apiKey configured`)
  }

  const baseUrl = provider.baseUrl.replace(/\/+$/, '')
  const url = `${baseUrl}${provider.apiPath}`

  // Normalize to OpenAI-compatible format with streaming enabled
  const body = {
    model: modelId,
    messages,
    stream: true,
    temperature: 0.2,
    max_tokens: 256,
  }

  console.log(`[LLM] → POST ${url} (provider: ${provider.name}, model: ${modelId}, stream: true)`)

  const started = Date.now()
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(body),
  }, 120_000)

  console.log(`[LLM] ← HTTP ${response.status} (${Date.now() - started}ms)`)

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(
      `LLM request failed (${response.status}): ${errText.slice(0, 500) || response.statusText}`,
    )
  }

  const contentType = response.headers.get('content-type') ?? ''
  const raw = await response.text()
  const elapsed = Date.now() - started

  console.log(`[LLM] ← response type: ${contentType} (${raw.length} bytes, ${elapsed}ms)`)

  // Parse response — handle both SSE and plain JSON
  let content: string
  if (contentType.includes('text/event-stream') || raw.includes('data:')) {
    content = parseSseContent(raw)
  } else {
    const data = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>
      error?: { message?: string }
    }
    if (data.error?.message) {
      throw new Error(data.error.message)
    }
    content = data.choices?.[0]?.message?.content ?? ''
  }

  if (!content) {
    throw new Error('LLM response content is empty')
  }

  console.log(`[LLM] ← ${content.slice(0, 200)}${content.length > 200 ? '…' : ''}`)

  const move = extractMove(content)
  if (!move) {
    throw new Error(`Cannot parse move from LLM response: ${content.slice(0, 200)}`)
  }

  console.log(`[LLM] ← extracted move: "${move}" (len=${move.length}, codes=${[...move].map(c => c.charCodeAt(0)).join(',')})`)

  return { move, rawContent: content }
}

function parseSseContent(raw: string): string {
  let content = ''
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:') || trimmed === 'data: [DONE]') continue
    try {
      const data = JSON.parse(trimmed.slice(5).trim())
      const choices = data.choices
      if (!choices || !Array.isArray(choices) || choices.length === 0) continue

      const choice = choices[0]
      // Support both streaming (delta) and non-streaming (message) within the data field
      const part = choice.delta?.content || choice.message?.content || ''
      content += part
    } catch {
      /* ignore parse errors */
    }
  }
  return content.trim()
}

function extractMove(content: string): string | null {
  const trimmed = content.trim()

  // Try JSON parse
  try {
    const json = JSON.parse(trimmed) as { move?: string }
    if (json.move?.trim()) return json.move.trim()
  } catch {
    /* fall through */
  }

  // Try markdown code block
  const codeMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (codeMatch) {
    return extractMove(codeMatch[1])
  }

  // Try inline JSON
  const inline = trimmed.match(/\{\s*"move"\s*:\s*"([^"]+)"\s*\}/)
  if (inline?.[1]) return inline[1].trim()

  // Accept raw move notation (3-4 chars like 炮二平五, 马8进7)
  const moveMatch = trimmed.match(/([炮砲車车馬马相象士仕兵卒将帥帅][一二三四五六七八九0-9０-９][进退平][一二三四五六七八九0-9０-９])/)
  if (moveMatch?.[1]) return moveMatch[1]

  return null
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  ms: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}
