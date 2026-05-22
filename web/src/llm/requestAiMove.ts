import { type PieceSide } from 'zh-chess'
import type { MoveRecord } from '../types/gameSession'
import { requestAiMoveFromServer, type AiMoveResult } from './apiClient'
import { logLlm } from './debug'
import { loadLlmSettings } from '../storage/llmSettingsStore'
import { type UciMoveInfo, normalizeFenForEngine } from '../utils/uciToNotation'
import { requestAiMoveFromLocal } from '../utils/engine/localEngine'

export interface RequestAiMoveInput {
  positionPen: string
  moveHistory: MoveRecord[]
  aiSide: PieceSide
  lastError?: string
  engineDepth?: number
}

export interface RequestAiMoveResult {
  move: string
  moveInfo?: UciMoveInfo
  /** Engine evaluation info. */
  fullPrompt?: string
  /** Raw engine response. */
  rawContent?: string
  evaluation?: number
}

/**
 * Request a move from the rule-based engine.
 */
export async function requestAiMove(
  input: RequestAiMoveInput,
): Promise<RequestAiMoveResult> {
  const settings = loadLlmSettings()

  logLlm('requestAiMove 局面', {
    aiSide: input.aiSide,
    positionPen: input.positionPen,
    provider: settings.providerId,
    engineDepth: input.engineDepth
  })

  let result: AiMoveResult

  const history = input.moveHistory.map(m => normalizeFenForEngine(m.penCode))

  if (settings.providerId === 'local-engine') {
    result = await requestAiMoveFromLocal(input.positionPen, history, 5.0, input.engineDepth)
  } else {
    result = await requestAiMoveFromServer({
      providerId: settings.providerId,
      modelId: settings.modelId,
      messages: [], // LLM messages are no longer needed
      positionPen: input.positionPen,
      moveSide: input.aiSide,
      depth: input.engineDepth,
      history,
    })
  }

  return { 
    move: result.move, 
    moveInfo: result.moveInfo,
    fullPrompt: result.fullPrompt, 
    rawContent: result.rawContent,
    evaluation: result.evaluation,
  }
}
