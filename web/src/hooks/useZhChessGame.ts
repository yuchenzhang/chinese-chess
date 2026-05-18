import { useCallback, useEffect, useRef, useState } from 'react'
import ZhChess, {
  type MoveCallback,
  type PieceSide,
  peiceSideMap,
} from 'zh-chess'

/** zh-chess 按正方形画布布局；宽高不一致会在下方留白，且宽度过小时边缘棋子被裁切 */
export const BOARD_SIZE = 720
export const BOARD_PADDING = 40

export interface MoveRecord {
  side: PieceSide
  penCode: string
  inCheck: boolean
}

export interface ZhChessGameState {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  playerSide: PieceSide
  setPlayerSide: (side: PieceSide) => void
  currentTurn: PieceSide | null
  positionPen: string
  moveHistory: MoveRecord[]
  winner: PieceSide | null
  statusMessage: string
  startNewGame: () => void
  flipBoard: () => void
}

export function useZhChessGame(): ZhChessGameState {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<ZhChess | null>(null)
  const [playerSide, setPlayerSide] = useState<PieceSide>('RED')
  const [currentTurn, setCurrentTurn] = useState<PieceSide | null>(null)
  const [positionPen, setPositionPen] = useState('')
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([])
  const [winner, setWinner] = useState<PieceSide | null>(null)
  const [statusMessage, setStatusMessage] = useState('选择执子方后点击「新对局」开始')

  const refreshPen = useCallback((side: PieceSide) => {
    const game = gameRef.current
    if (!game) return
    setPositionPen(game.getCurrentPenCode(side))
  }, [])

  const startNewGame = useCallback(() => {
    const game = gameRef.current
    const canvas = canvasRef.current
    if (!game || !canvas) return

    setWinner(null)
    setMoveHistory([])
    game.gameStart(playerSide)
    setCurrentTurn(playerSide)
    refreshPen(playerSide)
    setStatusMessage(`${peiceSideMap[playerSide]}行棋 — 本地双人对弈`)
    const ctx = canvas.getContext('2d')
    if (ctx) game.draw(ctx)
  }, [playerSide, refreshPen])

  const flipBoard = useCallback(() => {
    const game = gameRef.current
    if (!game) return
    game.changePlaySide(playerSide)
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (ctx) game.draw(ctx)
  }, [playerSide])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const game = new ZhChess({
      ctx,
      gameWidth: BOARD_SIZE,
      gameHeight: BOARD_SIZE,
      gamePadding: BOARD_PADDING,
      checkerboardBackground: '#e8c890',
      redPeiceBackground: '#fff8e8',
      blackPeiceBackground: '#f5ecd8',
      redPeiceTextColor: '#b91c1c',
      blackPeiceTextColor: '#1c1917',
      choosePeiceBorderColor: '#d97706',
      movePointColor: '#15803d',
      boardTextColor: '#44403c',
    })

    gameRef.current = game

    const onMove: MoveCallback = (_piece, _cp, enemyInCheck, penCode) => {
      const turn = game.currentGameSide
      if (!turn) return

      const mover: PieceSide = turn === 'RED' ? 'BLACK' : 'RED'
      setCurrentTurn(turn)
      setMoveHistory((prev) => [
        ...prev,
        { side: mover, penCode, inCheck: enemyInCheck },
      ])
      refreshPen(turn)
      setStatusMessage(
        enemyInCheck
          ? `${peiceSideMap[mover]}已将军，${peiceSideMap[turn]}应棋`
          : `${peiceSideMap[turn]}行棋`,
      )
    }

    const onOver = (winnerSide: PieceSide) => {
      setWinner(winnerSide)
      setCurrentTurn(null)
      setStatusMessage(`${peiceSideMap[winnerSide]}获胜！`)
    }

    game.on('move', onMove)
    game.on('over', onOver)
    game.draw(ctx)

    const handleClick = (e: MouseEvent) => {
      if (game.gameOver()) return
      game.listenClickAsync(e)
    }

    canvas.addEventListener('click', handleClick)

    return () => {
      canvas.removeEventListener('click', handleClick)
      game.removeEvent('move', onMove)
      game.removeEvent('over', onOver)
    }
  }, [refreshPen])

  return {
    canvasRef,
    playerSide,
    setPlayerSide,
    currentTurn,
    positionPen,
    moveHistory,
    winner,
    statusMessage,
    startNewGame,
    flipBoard,
  }
}
