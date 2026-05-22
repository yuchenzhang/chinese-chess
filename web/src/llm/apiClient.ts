/**
 * Frontend API client — calls the backend server for all LLM operations.
 * The frontend never contacts LLM providers directly.
 */

import { getBackendUrl } from '../storage/llmConnectionStore'
import { normalizeFenForEngine, uciToNotation, type UciMoveInfo } from '../utils/uciToNotation'

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
  /** The computation depth of the engine. */
  depth?: number
}

export interface AiMoveResult {
  move: string
  moveInfo?: UciMoveInfo
  rawContent?: string
  /** The full prompt that was actually sent to the LLM (enhanced by backend). */
  fullPrompt?: string
  evaluation?: number
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
  // Return both remote and local engines
  return [
    {
      id: 'local-engine',
      name: '本地引擎 (浏览器 JS)',
      models: [{ id: 'default', name: '默认搜索深度 (6层)' }],
      configured: true
    },
    {
      id: 'rule-engine',
      name: '远程引擎 (Python)',
      models: [{ id: 'default', name: '默认搜索深度' }],
      configured: true
    }
  ]
}

export async function requestAiMoveFromServer(
  input: AiMoveRequest,
): Promise<AiMoveResult> {
  if (!input.positionPen) {
    throw new ApiClientError('缺少局面信息 (positionPen)')
  }

  const fen = normalizeFenForEngine(input.positionPen)
  const url = `${getBackendUrl()}/api/move/best`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen, depth: input.depth }),
  })

  if (!res.ok) {
    let message = `引擎请求失败 (${res.status})`
    try {
      const body = (await res.json()) as { detail?: string }
      if (body.detail) message = body.detail
    } catch { /* ignore */ }
    throw new ApiClientError(message, res.status)
  }

  const result = await res.json()
  
  if (!result.best_move) {
    throw new ApiClientError('引擎未返回有效着法', res.status)
  }

  // Convert UCI to Chinese notation for the frontend zh-chess engine
  const moveInfo = uciToNotation(input.positionPen, result.best_move)

  const parsedEvaluation = typeof result.evaluation === 'number'
    ? result.evaluation
    : result.evaluation != null
      ? parseFloat(result.evaluation)
      : undefined

  return {
    move: moveInfo.notation,
    moveInfo: moveInfo,
    rawContent: `最佳走法 (UCI): ${result.best_move}\n引擎评估: ${result.evaluation}\n深度: ${result.depth}\n耗时: ${result.think_time}s`,
    fullPrompt: `FEN: ${fen}\nUCI: ${result.best_move}`,
    evaluation: isNaN(parsedEvaluation as any) ? undefined : parsedEvaluation,
  }
}

export async function pingServer(): Promise<{ status: string; timestamp?: string }> {
  const url = `${getBackendUrl()}/api/health`
  const res = await fetch(url)
  if (!res.ok) {
    throw new ApiClientError(`Server health check failed (${res.status})`, res.status)
  }
  return res.json()
}

export async function requestAiEvaluationFromServer(pen: string): Promise<number | null> {
  const fen = normalizeFenForEngine(pen)
  const url = `${getBackendUrl()}/api/evaluate`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen }),
    })

    if (!res.ok) {
      return null
    }

    const result = await res.json()
    const parsedEvaluation = typeof result.evaluation === 'number'
      ? result.evaluation
      : result.evaluation != null
        ? parseFloat(result.evaluation)
        : null

    return isNaN(parsedEvaluation as any) ? null : parsedEvaluation
  } catch (err) {
    return null
  }
}
