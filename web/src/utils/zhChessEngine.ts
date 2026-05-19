import type ZhChess from 'zh-chess'
import type { PieceSide } from 'zh-chess'

/** zh-chess 未导出 currentSide，走棋方需从此读取（勿用 currentGameSide，那是视角方 gameSide） */
export type ZhChessEngine = ZhChess & {
  currentSide: PieceSide
}

export function asEngine(game: ZhChess): ZhChessEngine {
  return game as ZhChessEngine
}

export function getEngineTurn(game: ZhChess): PieceSide {
  return asEngine(game).currentSide
}
