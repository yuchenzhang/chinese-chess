import type { PieceSide } from 'zh-chess'
import { peiceSideMap } from 'zh-chess'
import type { GameSession } from '../types/gameSession'
import { getAiSide } from './chessSides'

/** 标准开局红方先行 */
export const FIRST_MOVE_SIDE: PieceSide = 'RED'

export function statusMessageFor(session: GameSession, aiThinking: boolean): string {
  if (!session.vsAi) {
    return '请开启「与大模型对弈」后开始'
  }
  if (session.status === 'setup') {
    return '选择执子方，配置 API Key 后点击「开始对局」'
  }
  if (session.winner) {
    const youWin = session.winner === session.playerSide
    return youWin ? '你赢了！' : '大模型赢了！'
  }
  if (aiThinking) {
    return '大模型思考中…'
  }
  if (session.currentTurn === session.playerSide) {
    return '轮到你走棋'
  }
  if (session.currentTurn) {
    return `等待${peiceSideMap[getAiSide(session.playerSide)]}（AI）`
  }
  return '对局进行中'
}
