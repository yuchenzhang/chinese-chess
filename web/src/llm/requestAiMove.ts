import { type PieceSide } from 'zh-chess'
import type { MoveRecord } from '../types/gameSession'
import { requestAiMoveFromServer } from './apiClient'
import { logLlm } from './debug'
import { loadLlmSettings } from '../storage/llmSettingsStore'
import { type UciMoveInfo } from '../utils/uciToNotation'

export interface RequestAiMoveInput {
  positionPen: string
  moveHistory: MoveRecord[]
  aiSide: PieceSide
  lastError?: string
}

export interface RequestAiMoveResult {
  move: string
  moveInfo?: UciMoveInfo
  /** Engine evaluation info. */
  fullPrompt?: string
  /** Raw engine response. */
  rawContent?: string
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
  })

  const result = await requestAiMoveFromServer({
    providerId: settings.providerId,
    modelId: settings.modelId,
    messages: [], // LLM messages are no longer needed
    positionPen: input.positionPen,
    moveSide: input.aiSide,
  })

  return { 
    move: result.move, 
    moveInfo: result.moveInfo,
    fullPrompt: result.fullPrompt, 
    rawContent: result.rawContent 
  }
}
