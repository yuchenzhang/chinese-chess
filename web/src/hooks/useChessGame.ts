import { useCallback, useEffect, useRef, useState } from 'react'
import ZhChess, { type MoveCallback, type PieceSide, peiceSideMap } from 'zh-chess'
import {
  createSession as makeSession,
  loadStore,
  saveStore,
} from '../storage/sessionStore'
import type { GameSession, MoveRecord } from '../types/gameSession'
import { applySessionToBoard } from '../utils/applySessionToBoard'

/** zh-chess 按正方形画布布局 */
export const BOARD_SIZE = 720
export const BOARD_PADDING = 40

function statusMessageFor(session: GameSession): string {
  if (session.status === 'setup') {
    return '选择执子方后点击「开始对局」'
  }
  if (session.winner) {
    return `${peiceSideMap[session.winner]}获胜！`
  }
  if (session.currentTurn) {
    return `${peiceSideMap[session.currentTurn]}行棋 — 本地双人对弈`
  }
  return '对局进行中'
}

export interface UseChessGameResult {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  sessions: GameSession[]
  activeSession: GameSession
  activeSessionId: string
  playerSide: PieceSide
  setPlayerSide: (side: PieceSide) => void
  currentTurn: PieceSide | null
  positionPen: string
  moveHistory: MoveRecord[]
  winner: PieceSide | null
  statusMessage: string
  startNewGame: () => void
  flipBoard: () => void
  createSession: () => void
  switchSession: (id: string) => void
  deleteSession: (id: string) => void
  renameSession: (id: string, title: string) => void
}

export function useChessGame(): UseChessGameResult {
  const initialStore = useRef(loadStore())
  const [sessions, setSessions] = useState<GameSession[]>(initialStore.current.sessions)
  const [activeSessionId, setActiveSessionId] = useState(
    initialStore.current.activeSessionId ?? initialStore.current.sessions[0].id,
  )

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<ZhChess | null>(null)
  const activeSessionIdRef = useRef(activeSessionId)
  const sessionsRef = useRef(sessions)

  activeSessionIdRef.current = activeSessionId
  sessionsRef.current = sessions

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ?? sessions[0]

  const persist = useCallback((nextSessions: GameSession[], nextActiveId: string) => {
    setSessions(nextSessions)
    setActiveSessionId(nextActiveId)
    saveStore({ version: 1, activeSessionId: nextActiveId, sessions: nextSessions })
  }, [])

  const patchActiveSession = useCallback(
    (patch: Partial<GameSession>) => {
      const id = activeSessionIdRef.current
      const now = Date.now()
      setSessions((prev) => {
        const next = prev.map((s) =>
          s.id === id ? { ...s, ...patch, updatedAt: now } : s,
        )
        sessionsRef.current = next
        saveStore({ version: 1, activeSessionId: id, sessions: next })
        return next
      })
    },
    [],
  )

  const loadSessionOnBoard = useCallback((session: GameSession) => {
    const game = gameRef.current
    const canvas = canvasRef.current
    if (!game || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    applySessionToBoard(game, session, ctx)
  }, [])

  const switchSession = useCallback(
    (id: string) => {
      if (id === activeSessionIdRef.current) return
      const session = sessionsRef.current.find((s) => s.id === id)
      if (!session) return
      persist(sessionsRef.current, id)
      loadSessionOnBoard(session)
    },
    [loadSessionOnBoard, persist],
  )

  const createSessionHandler = useCallback(() => {
    const session = makeSession()
    const next = [session, ...sessionsRef.current]
    persist(next, session.id)
    loadSessionOnBoard(session)
  }, [loadSessionOnBoard, persist])

  const deleteSession = useCallback(
    (id: string) => {
      let next = sessionsRef.current.filter((s) => s.id !== id)
      if (next.length === 0) {
        next = [makeSession()]
      }
      const nextActive =
        activeSessionIdRef.current === id ? next[0].id : activeSessionIdRef.current
      persist(next, nextActive)
      const session = next.find((s) => s.id === nextActive)!
      loadSessionOnBoard(session)
    },
    [loadSessionOnBoard, persist],
  )

  const renameSession = useCallback((id: string, title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return
    const next = sessionsRef.current.map((s) =>
      s.id === id ? { ...s, title: trimmed, updatedAt: Date.now() } : s,
    )
    persist(next, activeSessionIdRef.current)
  }, [persist])

  const setPlayerSide = useCallback(
    (side: PieceSide) => {
      patchActiveSession({ playerSide: side })
      const game = gameRef.current
      if (game) {
        game.changePlaySide(side)
        const ctx = canvasRef.current?.getContext('2d')
        if (ctx) game.draw(ctx)
      }
    },
    [patchActiveSession],
  )

  const startNewGame = useCallback(() => {
    const game = gameRef.current
    const canvas = canvasRef.current
    if (!game || !canvas) return

    const side = activeSession.playerSide
    game.gameStart(side)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    game.draw(ctx)

    patchActiveSession({
      status: 'active',
      winner: null,
      moveHistory: [],
      currentTurn: side,
      positionPen: game.getCurrentPenCode(side),
    })
  }, [activeSession.playerSide, patchActiveSession])

  const flipBoard = useCallback(() => {
    const game = gameRef.current
    if (!game) return
    game.changePlaySide(activeSession.playerSide)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) game.draw(ctx)
  }, [activeSession.playerSide])

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
      const id = activeSessionIdRef.current
      const now = Date.now()

      setSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id !== id) return s
          return {
            ...s,
            updatedAt: now,
            status: 'active' as const,
            currentTurn: turn,
            positionPen: game.getCurrentPenCode(turn),
            moveHistory: [
              ...s.moveHistory,
              { side: mover, penCode, inCheck: enemyInCheck },
            ],
          }
        })
        sessionsRef.current = next
        saveStore({
          version: 1,
          activeSessionId: id,
          sessions: next,
        })
        return next
      })
    }

    const onOver = (winnerSide: PieceSide) => {
      const id = activeSessionIdRef.current
      const now = Date.now()

      setSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id !== id) return s
          return {
            ...s,
            updatedAt: now,
            status: 'finished' as const,
            winner: winnerSide,
            currentTurn: null,
            positionPen: game.getCurrentPenCode(s.playerSide),
          }
        })
        sessionsRef.current = next
        saveStore({ version: 1, activeSessionId: id, sessions: next })
        return next
      })
    }

    game.on('move', onMove)
    game.on('over', onOver)

    const initial = sessionsRef.current.find((s) => s.id === activeSessionIdRef.current)
    if (initial) {
      applySessionToBoard(game, initial, ctx)
    } else {
      game.draw(ctx)
    }

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
  }, [])

  useEffect(() => {
    loadSessionOnBoard(activeSession)
  }, [activeSessionId])

  return {
    canvasRef,
    sessions,
    activeSession,
    activeSessionId,
    playerSide: activeSession.playerSide,
    setPlayerSide,
    currentTurn: activeSession.currentTurn,
    positionPen: activeSession.positionPen,
    moveHistory: activeSession.moveHistory,
    winner: activeSession.winner,
    statusMessage: statusMessageFor(activeSession),
    startNewGame,
    flipBoard,
    createSession: createSessionHandler,
    switchSession,
    deleteSession,
    renameSession,
  }
}
