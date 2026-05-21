import { useCallback, useEffect, useRef, useState } from 'react'
import ZhChess, { type MoveCallback, type PieceSide } from 'zh-chess'
import { ApiClientError } from '../llm/apiClient'
import { requestAiMove } from '../llm/requestAiMove'
import {
  createSession as makeSession,
  loadStore,
  saveStore,
} from '../storage/sessionStore'

import type { CapturedPieceInfo, GameSession } from '../types/gameSession'
import { applySessionToBoard } from '../utils/applySessionToBoard'
import { getAiSide, oppositeSide } from '../utils/chessSides'
import { statusMessageFor } from '../utils/gameSessionHelpers'
import { getEngineTurn } from '../utils/zhChessEngine'
import { moveToNotation } from '../utils/notation'
import { getPieceAtPosition, isNotableMove } from '../utils/penParser'

export const BOARD_SIZE = 720
export const BOARD_PADDING = 40

const MAX_AI_RETRIES = 3

export interface UseChessGameResult {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  gameRef: React.RefObject<ZhChess | null>
  sessions: GameSession[]
  activeSession: GameSession
  activeSessionId: string
  playerSide: PieceSide
  setPlayerSide: (side: PieceSide) => void
  vsAi: boolean
  setVsAi: (vsAi: boolean) => void
  currentTurn: PieceSide | null
  positionPen: string
  moveHistory: GameSession['moveHistory']
  winner: PieceSide | null
  statusMessage: string
  aiThinking: boolean
  aiError: string | null
  lastAiPrompt: string | null
  lastAiResponse: string | null
  canPlayerMove: boolean
  startNewGame: () => void
  startCoachingScenario: (scenario: any) => void
  undoMove: () => void
  keyPieceAlert: { pieceName: string } | null
  clearKeyPieceAlert: () => void
  triggerAiMove: () => void
  flipBoard: () => void
  createSession: () => void
  switchSession: (id: string) => void
  deleteSession: (id: string) => void
  renameSession: (id: string, title: string) => void
  patchActiveSession: (patch: Partial<GameSession>) => void
}

export function useChessGame(): UseChessGameResult {
  const initialStore = useRef(loadStore())
  const [sessions, setSessions] = useState<GameSession[]>(initialStore.current.sessions)
  const [activeSessionId, setActiveSessionId] = useState(
    initialStore.current.activeSessionId ?? initialStore.current.sessions[0].id,
  )
  const [aiThinking, setAiThinking] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [lastAiPrompt, setLastAiPrompt] = useState<string | null>(null)
  const [lastAiResponse, setLastAiResponse] = useState<string | null>(null)
  const [keyPieceAlert, setKeyPieceAlert] = useState<{ pieceName: string } | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<ZhChess | null>(null)
  const activeSessionIdRef = useRef(activeSessionId)
  const sessionsRef = useRef(sessions)
  const aiRunIdRef = useRef(0)
  const aiThinkingRef = useRef(false)
  const runAiTurnRef = useRef<() => Promise<void>>(async () => {})

  aiThinkingRef.current = aiThinking

  activeSessionIdRef.current = activeSessionId
  sessionsRef.current = sessions

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ?? sessions[0]

  const persist = useCallback((nextSessions: GameSession[], nextActiveId: string) => {
    setSessions(nextSessions)
    setActiveSessionId(nextActiveId)
    sessionsRef.current = nextSessions
    saveStore({ version: 1, activeSessionId: nextActiveId, sessions: nextSessions })
  }, [])

  const patchActiveSession = useCallback((patch: Partial<GameSession>) => {
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
  }, [])

  const loadSessionOnBoard = useCallback((session: GameSession) => {
    const game = gameRef.current
    const canvas = canvasRef.current
    if (!game || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    applySessionToBoard(game, session, ctx)
  }, [])

  const runAiTurn = useCallback(async () => {
    const game = gameRef.current
    const canvas = canvasRef.current
    if (!game || !canvas) return

    const session = sessionsRef.current.find((s) => s.id === activeSessionIdRef.current)
    if (!session?.vsAi || session.status !== 'active' || session.winner) return

    const ai = getAiSide(session.playerSide)
    if (getEngineTurn(game) !== ai) return

    const runId = ++aiRunIdRef.current
    setAiThinking(true)
    setAiError(null)

    let lastError: string | undefined

    try {
      if (import.meta.env.DEV) {
        console.log('[象棋·AI] 开始请求引擎走棋', {
          aiSide: ai,
          sessionId: activeSessionIdRef.current,
        })
      }

      for (let attempt = 0; attempt < MAX_AI_RETRIES; attempt++) {
        if (runId !== aiRunIdRef.current) return

        const latest = sessionsRef.current.find((s) => s.id === activeSessionIdRef.current)
        if (!latest) return

        if (import.meta.env.DEV) {
          console.log(`[象棋·AI] 第 ${attempt + 1} 次尝试`, {
            positionPen: latest.positionPen,
            moves: latest.moveHistory.length,
          })
        }

        setLastAiPrompt(
          `请求引擎中... (局面: ${latest.positionPen})`,
        )

        try {
          const { move, moveInfo, fullPrompt, rawContent } = await requestAiMove({
            positionPen: latest.positionPen,
            moveHistory: latest.moveHistory,
            aiSide: ai,
            lastError,
            engineDepth: latest.engineDepth,
          })

          console.log('[象棋·AI] 收到后端返回', {
            move,
            moveInfo,
            aiSide: ai,
            runId,
          })

          if (rawContent) {
            setLastAiResponse(rawContent)
          }

          // Replace locally-built prompt with backend-returned full prompt
          if (fullPrompt) {
            setLastAiPrompt(fullPrompt)
          }

          if (runId !== aiRunIdRef.current) {
            console.log('[象棋·AI] 请求已过期，忽略')
            return
          }

          if (moveInfo && moveInfo.fromX !== -1) {
            console.log('[象棋·AI] 正在通过坐标执行走子:', moveInfo)
            const piece = game.currentLivePieceList.find(
              (p) => p.x === moveInfo.fromX && p.y === moveInfo.fromY,
            )
            if (piece) {
              const toPoint = { x: moveInfo.toX, y: moveInfo.toY }
              const result = await game.updateAsync(piece as any, toPoint as any, ai, true)
              console.log('[象棋·AI] updateAsync 结果:', result)
              if (result.flag) {
                if (import.meta.env.DEV) console.log('[象棋·AI] 落子成功')
                setAiError(null)
                return
              }
              lastError = (result as any).message || '未知更新失败'
            } else {
              lastError = `未在坐标 (${moveInfo.fromX}, ${moveInfo.fromY}) 找到棋子`
            }
          } else {
            console.log('[象棋·AI] 正在通过记谱执行走子:', move)
            const result = await game.moveStrAsync(move, ai, true)
            console.log('[象棋·AI] moveStrAsync 结果:', result)
            if (result.flag) {
              if (import.meta.env.DEV) console.log('[象棋·AI] 落子成功')
              setAiError(null)
              return
            }
            lastError = !result.flag && 'message' in result ? result.message : '非法着法或未找到棋子'
          }
          console.log('[象棋·AI] 落子失败，lastError:', lastError, 'move:', move)
        } catch (err) {
          const msg =
            err instanceof ApiClientError
              ? err.message
              : err instanceof Error
                ? err.message
                : '请求引擎失败'
          
          lastError = msg
          console.log(`[象棋·AI] 第 ${attempt + 1} 次尝试失败:`, msg)

          // Show the backend-enhanced prompt even on error
          if (err instanceof ApiClientError && err.fullPrompt) {
            setLastAiPrompt(err.fullPrompt)
          }
          
          // If it's a non-retriable error (like 401/404), we might want to break,
          // but for now we'll just retry until limit.
          if (attempt === MAX_AI_RETRIES - 1) {
            throw err
          }
        }
      }

      setAiError(lastError ?? '引擎连续返回非法着法')
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : '请求引擎失败'
      setAiError(msg)
      // Show the backend-enhanced prompt even on error
      if (err instanceof ApiClientError && err.fullPrompt) {
        setLastAiPrompt(err.fullPrompt)
      }
    } finally {
      if (runId === aiRunIdRef.current) {
        setAiThinking(false)
      }
    }
  }, [])

  runAiTurnRef.current = runAiTurn

  const maybeRequestAi = useCallback((turn: PieceSide | null) => {
    const session = sessionsRef.current.find((s) => s.id === activeSessionIdRef.current)
    if (!session?.vsAi || !turn || session.winner) return
    if (turn === getAiSide(session.playerSide)) {
      setAiThinking(true)
      void runAiTurnRef.current()
    }
  }, [])

  const triggerAiMove = useCallback(() => {
    const session = sessionsRef.current.find((s) => s.id === activeSessionIdRef.current)
    if (!session?.vsAi || session.status !== 'active' || session.winner) return
    
    // 如果明确是玩家回合，则不触发 AI；否则（包括 null 情况）允许触发
    if (session.currentTurn === session.playerSide) return

    setAiThinking(true)
    void runAiTurnRef.current()
  }, [])

  const switchSession = useCallback(
    (id: string) => {
      if (id === activeSessionIdRef.current) return
      aiRunIdRef.current++
      setAiThinking(false)
      setAiError(null)
      const session = sessionsRef.current.find((s) => s.id === id)
      if (!session) return
      persist(sessionsRef.current, id)
      loadSessionOnBoard(session)
    },
    [loadSessionOnBoard, persist],
  )

  const createSessionHandler = useCallback(() => {
    aiRunIdRef.current++
    setAiThinking(false)
    setAiError(null)
    const session = makeSession({ vsAi: true })
    const next = [session, ...sessionsRef.current]
    persist(next, session.id)
    loadSessionOnBoard(session)
  }, [loadSessionOnBoard, persist])

  const deleteSession = useCallback(
    (id: string) => {
      aiRunIdRef.current++
      setAiThinking(false)
      setAiError(null)
      let next = sessionsRef.current.filter((s) => s.id !== id)
      if (next.length === 0) {
        next = [makeSession({ vsAi: true })]
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

  const setVsAi = useCallback(
    (vsAi: boolean) => {
      aiRunIdRef.current++
      setAiThinking(false)
      setAiError(null)
      const id = activeSessionIdRef.current
      const now = Date.now()
      setSessions((prev) => {
        const next = prev.map((s) =>
          s.id === id
            ? {
                ...s,
                vsAi,
                updatedAt: now,
                status: 'setup' as const,
                winner: null,
                moveHistory: [],
                currentTurn: null,
              }
            : s,
        )
        sessionsRef.current = next
        saveStore({ version: 1, activeSessionId: id, sessions: next })
        const session = next.find((s) => s.id === id)
        if (session) queueMicrotask(() => loadSessionOnBoard(session))
        return next
      })
    },
    [loadSessionOnBoard],
  )

  const undoMove = useCallback(() => {
    const session = sessionsRef.current.find((s) => s.id === activeSessionIdRef.current)
    if (!session || session.moveHistory.length === 0) return
    if (aiThinkingRef.current) return

    setKeyPieceAlert(null)
    setAiError(null)
    aiRunIdRef.current++

    let newHistory = [...session.moveHistory]
    const lastMove = newHistory[newHistory.length - 1]

    if (session.vsAi) {
      if (lastMove.side !== session.playerSide) {
        // Undo AI's move and Human's move
        newHistory.pop()
        newHistory.pop()
      } else {
        // Only undo Human's move (e.g. if AI errored out)
        newHistory.pop()
      }
    } else {
      newHistory.pop()
    }

    const newPen = newHistory.length > 0
      ? newHistory[newHistory.length - 1].penCode
      : (session.initialPen ?? session.positionPen)

    // Recover current turn from newPen
    const penParts = newPen.split(' ')
    const turnChar = penParts[1] || 'r'
    const newTurn: PieceSide = (turnChar === 'r' || turnChar === 'w') ? 'RED' : 'BLACK'

    patchActiveSession({
      moveHistory: newHistory,
      positionPen: newPen,
      currentTurn: newTurn,
      winner: null,
      status: 'active',
    })

    const updatedSession = { ...session, moveHistory: newHistory, positionPen: newPen, currentTurn: newTurn, winner: null, status: 'active' as const }
    queueMicrotask(() => loadSessionOnBoard(updatedSession))
  }, [patchActiveSession, loadSessionOnBoard])

  const startNewGame = useCallback(() => {
    const game = gameRef.current
    const canvas = canvasRef.current
    const session = sessionsRef.current.find((s) => s.id === activeSessionIdRef.current)
    if (!game || !canvas || !session) return

    setAiError(null)
    aiRunIdRef.current++

    const side = session.playerSide
    game.gameStart(side)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    game.draw(ctx)

    const firstTurn = getEngineTurn(game)
    const newPen = game.getCurrentPenCode(firstTurn)
    patchActiveSession({
      status: 'active',
      winner: null,
      moveHistory: [],
      currentTurn: firstTurn,
      initialPen: newPen,
      positionPen: newPen,
    })

    if (session.vsAi && firstTurn === getAiSide(side)) {
      queueMicrotask(() => void runAiTurnRef.current())
    }
  }, [patchActiveSession])

  const startCoachingScenario = useCallback((scenario: any) => {
    aiRunIdRef.current++
    setAiThinking(false)
    setAiError(null)

    // Parse turn from PEN (r/w/b)
    const penParts = (scenario.initial_pen || '').split(' ')
    const turnChar = penParts[1] || 'r'
    const turn: PieceSide = (turnChar === 'r' || turnChar === 'w') ? 'RED' : 'BLACK'

    const active = sessionsRef.current.find(s => s.id === activeSessionIdRef.current)
    const session = makeSession({
      vsAi: true,
      title: `${scenario.title}`,
      positionPen: scenario.initial_pen,
      coachingInstruction: scenario.instruction,
      playerSide: turn
    })

    session.isCoaching = true
    session.llmAnalysis = active?.llmAnalysis
    session.status = 'active'
    session.currentTurn = turn

    const next = [session, ...sessionsRef.current]
    persist(next, session.id)
    loadSessionOnBoard(session)
  }, [loadSessionOnBoard, persist])

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

    const onMove: MoveCallback = (piece, cp, enemyInCheck, penCode) => {
      // 使用 piece.side 确定走子方，比 getEngineTurn(game) 更可靠（避免 side 已提前切换）
      const mover = piece.side
      const nextTurn = oppositeSide(mover)
      const isCapture = 'eat' in cp
      const destination = isCapture ? cp.eat : cp.move

      // 计算中文记谱
      const notation = moveToNotation(
        { name: piece.name, x: piece.x, y: piece.y },
        destination,
        mover,
      )

      // Detect captured piece from previous position
      let captured: CapturedPieceInfo | undefined
      if (isCapture) {
        const session = sessionsRef.current.find((s) => s.id === activeSessionIdRef.current)
        const prevPen = session?.moveHistory.length
          ? session.moveHistory[session.moveHistory.length - 1].penCode
          : session?.positionPen
        if (prevPen) {
          const capturedInfo = getPieceAtPosition(prevPen, destination.x, destination.y)
          if (capturedInfo) {
            captured = {
              name: capturedInfo.name,
              side: capturedInfo.side,
              displayName: capturedInfo.displayName,
            }
          }
        }
      }

      // Detect notable moves (forks, capturing high-value pieces)
      let isNotableMoveFlag = false
      let notableReason: string | undefined
      const penCharForNotable = isCapture
        ? (captured?.side === 'RED'
          ? Object.entries({ R: '車', N: '馬', B: '相', A: '仕', K: '帅', C: '炮', P: '兵' }).find(([, v]) => v === captured?.name)?.[0]
          : Object.entries({ r: '车', n: '马', b: '象', a: '士', k: '将', c: '砲', p: '卒' }).find(([, v]) => v === captured?.name)?.[0])
        : null
      const notableResult = isNotableMove(
        penCode,
        destination.x,
        destination.y,
        mover,
        penCharForNotable ?? null,
      )
      if (notableResult.notable) {
        isNotableMoveFlag = true
        notableReason = notableResult.reason
      }

      if (import.meta.env.DEV) {
        console.log('[象棋·DEBUG] onMove fired', {
          mover,
          nextTurn,
          notation,
          isCapture,
          captured,
          isNotable: isNotableMoveFlag,
          notableReason,
          penCodeFromCallback: penCode,
        })
      }
      const id = activeSessionIdRef.current
      const now = Date.now()

      if (captured) {
        const session = sessionsRef.current.find((s) => s.id === id)
        if (session && session.vsAi && mover !== session.playerSide && captured.side === session.playerSide) {
          if (['车', '马', '炮'].includes(captured.displayName)) {
            setKeyPieceAlert({ pieceName: captured.displayName })
          }
        }
      }

      setSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id !== id) return s
          return {
            ...s,
            updatedAt: now,
            status: 'active' as const,
            currentTurn: nextTurn,
            positionPen: penCode,
            moveHistory: [
              ...s.moveHistory,
              {
                side: mover,
                penCode,
                notation,
                inCheck: enemyInCheck,
                captured,
                isNotable: isNotableMoveFlag || undefined,
                notableReason,
              },
            ],
          }
        })
        sessionsRef.current = next
        saveStore({ version: 1, activeSessionId: id, sessions: next })
        return next
      })

      queueMicrotask(() => maybeRequestAi(nextTurn))
    }

    const onOver = (winnerSide: PieceSide) => {
      aiRunIdRef.current++
      setAiThinking(false)
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
      // 如果已在对局中但缺少回合信息，尝试从引擎恢复
      if (initial.status === 'active' && !initial.winner && !initial.currentTurn) {
        const engineTurn = getEngineTurn(game)
        console.log('[象棋·DEBUG] 恢复丢失的回合信息:', engineTurn)
        patchActiveSession({ currentTurn: engineTurn })
      }
    } else {
      game.draw(ctx)
    }

    const handleClick = (e: MouseEvent) => {
      if (game.gameOver()) return

      const session = sessionsRef.current.find((s) => s.id === activeSessionIdRef.current)
      if (!session || session.status !== 'active') return
      if (aiThinkingRef.current) return

      if (session.vsAi) {
        if (getEngineTurn(game) !== session.playerSide) return
      } else {
        const internal = game as unknown as { gameSide: PieceSide | null }
        const engineTurn = getEngineTurn(game)
        if (internal.gameSide !== engineTurn) {
          internal.gameSide = engineTurn
        }
      }

      game.listenClickAsync(e)
    }

    canvas.addEventListener('click', handleClick)

    return () => {
      canvas.removeEventListener('click', handleClick)
      game.removeEvent('move', onMove)
      game.removeEvent('over', onOver)
    }
  }, [maybeRequestAi])

  useEffect(() => {
    aiRunIdRef.current++
    setAiThinking(false)
    loadSessionOnBoard(activeSession)
    
    // If it's AI turn on load/switch, trigger it
    if (activeSession.vsAi && activeSession.status === 'active' && !activeSession.winner) {
      const ai = getAiSide(activeSession.playerSide)
      if (activeSession.currentTurn === ai) {
        setAiThinking(true)
        void runAiTurnRef.current()
      }
    }
  }, [activeSessionId, loadSessionOnBoard])

  useEffect(() => {
    const handleStartTour = () => {
      // Find or create demo session
      let demoSession = sessionsRef.current.find(s => s.title === '演示：经典开局复盘');
      
      if (!demoSession) {
        console.log('[象棋·演示] 正在创建并注入演示数据...');
        demoSession = makeSession({
          vsAi: true,
          title: '演示：经典开局复盘',
        });
        
        demoSession.moveHistory = [
          { side: 'RED', notation: '炮二平五', penCode: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C2C1/9/RNBAKABNR b - - 0 1', inCheck: false },
          { side: 'BLACK', notation: '马8进7', penCode: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C2C1/9/RNBAKABNR r - - 0 2', inCheck: false }
        ];
        demoSession.status = 'active';
        demoSession.currentTurn = 'RED';
        demoSession.updatedAt = Date.now();
        
        const next = [demoSession, ...sessionsRef.current];
        persist(next, demoSession.id);
      } else {
        console.log('[象棋·演示] 切换到已有的演示数据');
        switchSession(demoSession.id);
      }

      // Force board update
      const target = demoSession;
      setTimeout(() => loadSessionOnBoard(target), 50);
    };
    window.addEventListener('start-tour', handleStartTour);
    return () => window.removeEventListener('start-tour', handleStartTour);
  }, [persist, loadSessionOnBoard]);

  const canPlayerMove =
    activeSession.vsAi &&
    activeSession.status === 'active' &&
    !activeSession.winner &&
    !aiThinking &&
    activeSession.currentTurn === activeSession.playerSide

  const displayStatus = aiError
    ? aiError
    : statusMessageFor(activeSession, aiThinking)

  const clearKeyPieceAlert = useCallback(() => {
    setKeyPieceAlert(null)
  }, [])

  return {
    canvasRef,
    gameRef,
    sessions,
    activeSession,
    activeSessionId,
    playerSide: activeSession.playerSide,
    setPlayerSide,
    vsAi: activeSession.vsAi,
    setVsAi,
    currentTurn: activeSession.currentTurn,
    positionPen: activeSession.positionPen,
    moveHistory: activeSession.moveHistory,
    winner: activeSession.winner,
    statusMessage: displayStatus,
    aiThinking,
    aiError,
    lastAiPrompt,
    lastAiResponse,
    keyPieceAlert,
    canPlayerMove,
    startNewGame,
    startCoachingScenario,
    triggerAiMove,
    undoMove,
    clearKeyPieceAlert,
    flipBoard,
    createSession: createSessionHandler,
    switchSession,
    deleteSession,
    renameSession,
    patchActiveSession,
  }
}
