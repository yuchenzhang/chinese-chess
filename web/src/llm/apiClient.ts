/**
 * Frontend API client — calls the backend server for all LLM operations.
 * The frontend never contacts LLM providers directly.
 */

import { getBackendUrl } from '../storage/llmConnectionStore'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiMoveRequest {
  providerId: string
  modelId: string
  messages: ChatMessage[]
  /** For server-side move validation. */
  positionPen?: string
  /** The AI's side — used for validation since PEN turn letter may not match. */
  moveSide?: 'RED' | 'BLACK'
}

export interface AiMoveResult {
  move: string
  rawContent?: string
  /** The full prompt that was actually sent to the LLM (enhanced by backend). */
  fullPrompt?: string
}

export interface LlmProviderInfo {
  id: string
  name: string
  models: Array<{ id: string; name: string }>
  configured: boolean
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status?: number,
    public fullPrompt?: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

export { getBackendUrl } from '../storage/llmConnectionStore'

export async function fetchProviders(): Promise<LlmProviderInfo[]> {
  const url = `${getBackendUrl()}/api/ai/providers`
  const res = await fetch(url)
  if (!res.ok) {
    throw new ApiClientError(`Failed to fetch providers (${res.status})`, res.status)
  }
  return res.json()
}

export async function requestAiMoveFromServer(
  input: AiMoveRequest,
): Promise<AiMoveResult> {
  const url = `${getBackendUrl()}/api/ai/move`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    let message = `请求失败 (${res.status})`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch { /* ignore */ }
    throw new ApiClientError(message, res.status)
  }

  const result: AiMoveResult = await res.json()
  if (!result.move) {
    const errorBody = result as { error?: string; fullPrompt?: string }
    const errorMsg = errorBody.error ?? '后端返回的着法为空'
    throw new ApiClientError(errorMsg, res.status, errorBody.fullPrompt)
  }
  return result
}

export async function pingServer(): Promise<{ status: string; timestamp?: string }> {
  const url = `${getBackendUrl()}/api/health`
  const res = await fetch(url)
  if (!res.ok) {
    throw new ApiClientError(`Server health check failed (${res.status})`, res.status)
  }
  return res.json()
}
