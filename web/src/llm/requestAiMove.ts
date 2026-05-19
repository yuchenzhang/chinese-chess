import { peiceSideMap, type PieceSide } from 'zh-chess'
import type { MoveRecord } from '../types/gameSession'
import { requestAiMoveFromServer } from './apiClient'
import { logLlm } from './debug'
import { loadLlmSettings } from '../storage/llmSettingsStore'

export interface RequestAiMoveInput {
  positionPen: string
  moveHistory: MoveRecord[]
  aiSide: PieceSide
  lastError?: string
}

export interface RequestAiMoveResult {
  move: string
  /** The full prompt actually sent to the LLM (enhanced by backend with visual board). */
  fullPrompt?: string
  /** Raw content returned by the LLM. */
  rawContent?: string
}

export function buildAiMovePrompt(input: RequestAiMoveInput): string {
  const sideLabel = peiceSideMap[input.aiSide]
  const historyText =
    input.moveHistory.length === 0
      ? '（尚无走子）'
      : input.moveHistory
          .map((m, i) => `${i + 1}. ${peiceSideMap[m.side]}: ${m.notation}`)
          .join('\n')

  const retryHint = input.lastError
    ? `\n上一次着法非法：${input.lastError}。请重新选择合法着法。`
    : ''

  return `当前局面（PEN）：
${input.positionPen}

走子记录：
${historyText}

你是${sideLabel}，请走出下一步。要求：
1. 使用中文象棋记谱，注意：本系统统一使用从右向左（红方视角）的 1-9 路编号。
2. 只输出 JSON，不要 markdown，不要解释
3. 格式：{"move":"你的着法"}${retryHint}`
}

/** Returns the full message list sent to the LLM (system + user). */
export function buildFullMessages(input: RequestAiMoveInput) {
  return [
    {
      role: 'system' as const,
      content:
        '你是中国象棋对弈引擎助手。当前你正与人类玩家进行一局中国象棋对弈。根据局面只返回合法着法的 JSON，键名 move，值为中文记谱字符串。不要调用工具，不要解释。',
    },
    { role: 'user' as const, content: buildAiMovePrompt(input) },
  ]
}

export async function requestAiMove(
  input: RequestAiMoveInput,
): Promise<RequestAiMoveResult> {
  const settings = loadLlmSettings()

  logLlm('requestAiMove 局面', {
    aiSide: input.aiSide,
    positionPen: input.positionPen,
    moveHistory: input.moveHistory,
    lastError: input.lastError,
  })

  const messages = buildFullMessages(input)

  const result = await requestAiMoveFromServer({
    providerId: settings.providerId,
    modelId: settings.modelId,
    messages,
    positionPen: input.positionPen,
    moveSide: input.aiSide,
  })

  // We strictly trust the move string returned by the server, as it has been validated
  // and normalized against the server-side engine which matches the frontend engine.
  const move = result.move

  logLlm('requestAiMove 着法', { rawMove: result.move, move })
  return { move, fullPrompt: result.fullPrompt, rawContent: result.rawContent }
}
