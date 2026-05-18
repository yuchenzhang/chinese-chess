import ZhChess, { initBoardPen, type PieceSide } from 'zh-chess'
import type { GameSession } from '../types/gameSession'

type InternalGameState = 'INIT' | 'START' | 'OVER' | 'MOVE'

type ZhChessInternals = {
  gameState: InternalGameState
  winner: PieceSide | null
  gameSide: PieceSide | null
}

export function applySessionToBoard(
  game: ZhChess,
  session: GameSession,
  ctx: CanvasRenderingContext2D,
): void {
  const internal = game as unknown as ZhChessInternals

  if (session.status === 'setup') {
    game.setPenCodeList(initBoardPen)
    internal.gameState = 'INIT'
    internal.winner = null
    internal.gameSide = null
  } else {
    game.setPenCodeList(session.positionPen || initBoardPen)
    internal.gameState = session.status === 'finished' ? 'OVER' : 'START'
    internal.winner = session.winner
    internal.gameSide = session.playerSide
  }

  game.changePlaySide(session.playerSide)
  game.draw(ctx)
}
