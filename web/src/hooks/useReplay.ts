import { useCallback, useEffect, useRef, useState } from 'react'
import ZhChess, { initBoardPen, type PieceSide } from 'zh-chess'
import type { GameSession } from '../types/gameSession'

type InternalGameState = 'INIT' | 'START' | 'OVER' | 'MOVE'
type ZhChessInternals = {
  gameState: InternalGameState
  winner: PieceSide | null
  gameSide: PieceSide | null
}

export interface UseReplayResult {
  /** Whether replay mode is active */
  isReplaying: boolean
  /** Current step (0 = initial position, 1..N = after move N) */
  currentPly: number
  /** Total number of moves available */
  totalPlies: number
  /** Whether auto-play is running */
  isPlaying: boolean
  /** Auto-play speed in ms per move */
  speed: number
  /** Enter replay mode */
  enterReplay: () => void
  /** Exit replay mode and return to live position */
  exitReplay: () => void
  /** Go to a specific ply */
  goToPly: (ply: number) => void
  /** Go to the first position */
  goToStart: () => void
  /** Go to the last position */
  goToEnd: () => void
  /** Step forward one move */
  stepForward: () => void
  /** Step backward one move */
  stepBackward: () => void
  /** Start/stop auto-play */
  togglePlay: () => void
  /** Set auto-play speed */
  setSpeed: (ms: number) => void
}

function penAtPly(session: GameSession, ply: number): string {
  if (ply <= 0) return initBoardPen
  const record = session.moveHistory[ply - 1]
  return record ? record.penCode : session.positionPen
}

export function useReplay(
  session: GameSession,
  gameRef: React.RefObject<ZhChess | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
): UseReplayResult {
  const [isReplaying, setIsReplaying] = useState(false)
  const [currentPly, setCurrentPly] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1000)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const totalPlies = session.moveHistory.length

  const renderPly = useCallback((ply: number) => {
    const game = gameRef.current
    const canvas = canvasRef.current
    if (!game || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pen = penAtPly(session, ply)
    game.setPenCodeList(pen)

    const internal = game as unknown as ZhChessInternals
    if (ply === totalPlies && session.status === 'finished') {
      internal.gameState = 'OVER'
      internal.winner = session.winner
    } else {
      internal.gameState = 'START'
      internal.winner = null
    }
    internal.gameSide = session.playerSide

    game.changePlaySide(session.playerSide)
    game.draw(ctx)
  }, [session, gameRef, canvasRef, totalPlies])

  const enterReplay = useCallback(() => {
    console.log('[象棋·回放] 尝试进入回放模式', { totalPlies, sessionId: session.id })
    if (totalPlies === 0) {
      console.warn('[象棋·回放] 进入失败：总步数为 0')
      return
    }
    setIsReplaying(true)
    setCurrentPly(0)
    setIsPlaying(false)
    renderPly(0)
  }, [totalPlies, renderPly, session.id])

  const exitReplay = useCallback(() => {
    console.log('[象棋·回放] 退出回放模式')
    setIsReplaying(false)
    setIsPlaying(false)
    setCurrentPly(0)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    const game = gameRef.current
    const canvas = canvasRef.current
    if (!game || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pen = session.positionPen || initBoardPen
    game.setPenCodeList(pen)
    const internal = game as unknown as ZhChessInternals
    if (session.status === 'finished') {
      internal.gameState = 'OVER'
      internal.winner = session.winner
    } else if (session.status === 'active') {
      internal.gameState = 'START'
      internal.winner = null
    } else {
      internal.gameState = 'INIT'
      internal.winner = null
    }
    internal.gameSide = session.playerSide
    game.changePlaySide(session.playerSide)
    game.draw(ctx)
  }, [session, gameRef, canvasRef])

  const goToPly = useCallback((ply: number) => {
    const clamped = Math.max(0, Math.min(ply, totalPlies))
    setCurrentPly(clamped)
    renderPly(clamped)
  }, [totalPlies, renderPly])

  const goToStart = useCallback(() => goToPly(0), [goToPly])
  const goToEnd = useCallback(() => goToPly(totalPlies), [goToPly, totalPlies])
  const stepForward = useCallback(() => goToPly(currentPly + 1), [goToPly, currentPly])
  const stepBackward = useCallback(() => goToPly(currentPly - 1), [goToPly, currentPly])

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev)
  }, [])

  useEffect(() => {
    if (!isReplaying || !isPlaying) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setCurrentPly((prev) => {
        const next = prev + 1
        if (next > totalPlies) {
          setIsPlaying(false)
          return prev
        }
        renderPly(next)
        return next
      })
    }, speed)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isReplaying, isPlaying, speed, totalPlies, renderPly])

  useEffect(() => {
    if (isReplaying) {
      setIsReplaying(false)
      setIsPlaying(false)
      setCurrentPly(0)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [session.id])

  return {
    isReplaying,
    currentPly,
    totalPlies,
    isPlaying,
    speed,
    enterReplay,
    exitReplay,
    goToPly,
    goToStart,
    goToEnd,
    stepForward,
    stepBackward,
    togglePlay,
    setSpeed,
  }
}
