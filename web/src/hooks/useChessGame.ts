import { useCallback, useEffect, useRef, useState } from 'react'
import ZhChess, { type MoveCallback, type PieceSide } from 'zh-chess'
import { ApiClientError } from '../llm/apiClient'
import { requestAiMove } from '../llm/requestAiMove'
import { Board, Move } from '../utils/engine/board'
import { AlphaBetaSearch } from '../utils/engine/search'
import {
  createSession as makeSession,
  loadStore,
  saveStore,
} from '../storage/sessionStore'

import type { CapturedPieceInfo, GameSession, MoveRecord, TacticalSnapshot } from '../types/gameSession'
import { addSnapshot } from '../storage/snapshotStore'

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
  moveHistory: MoveRecord[]
  winner: PieceSide | null
  statusMessage: string
  aiThinking: boolean
  aiError: string | null
  lastAiPrompt: string | null
  lastAiResponse: string | null
  keyPieceAlert: { pieceName: string } | null
  canPlayerMove: boolean
  startNewGame: () => void
  startCoachingScenario: (scenario: any) => void
  triggerAiMove: () => void
  undoMove: () => void
  clearKeyPieceAlert: () => void
  flipBoard: () => void
  createSession: () => void
  switchSession: (id: string) => void
  deleteSession: (id: string) => void
  renameSession: (id: string, title: string) => void
  patchActiveSession: (patch: Partial<GameSession>) => void
  startSnapshotPractice: (snapshot: TacticalSnapshot) => void
  exitSnapshotPractice: () => void
  pendingSnapshot: TacticalSnapshot | null
  confirmPendingSnapshot: () => void
  confirmPendingSnapshotWithType: (type: 'positive' | 'negative') => void
  cancelPendingSnapshot: () => void
  triggerManualSnapshot: (currentPly?: number) => void
  rollbackToPly: (targetPly: number) => void
  activeHint: { fromRow: number; fromCol: number; toRow: number; toCol: number } | null
  showHint: (type: 'offensive' | 'defensive') => void
  clearHint: () => void
}
import { applySessionToBoard } from '../utils/applySessionToBoard'
import { getAiSide, oppositeSide } from '../utils/chessSides'
import { statusMessageFor } from '../utils/gameSessionHelpers'
import { getEngineTurn } from '../utils/zhChessEngine'
import { moveToNotation } from '../utils/notation'
import { getPieceAtPosition, isNotableMove } from '../utils/penParser'

const getBoardConfig = (isCoachingActive = false) => {
  if (typeof window === 'undefined') return { size: 720, padding: 40 };
  const width = window.innerWidth;
  const height = window.innerHeight;

  let maxSize = 720;
  let padding = 40;

  if (width < 900) {
    // 移动端 (与 App.css 900px 媒体查询对齐)
    padding = 8;
    // vertical budget: Header (~130px) + Mobile Actions (~90px) + CapturedPieces (~60px) + gaps + Coaching Banner (if active, ~60px)
    const verticalBudget = isCoachingActive ? 380 : 320;
    const maxV = height - verticalBudget;
    const maxH = width - 24; // 左右各留 12px 的呼吸安全空间
    maxSize = Math.min(720, maxH, maxV);
  } else if (width < 1200) {
    // 中屏/平板端 (上下堆叠布局)
    padding = 24;
    // vertical budget: Header (~80px) + CapturedPieces (~60px) + Layout Padding (~48px) + gaps + Coaching Banner (if active, ~60px)
    const verticalBudget = isCoachingActive ? 290 : 230;
    const maxV = height - verticalBudget;
    const maxH = width - 48; // 左右各留 24px
    maxSize = Math.min(720, maxH, maxV);
  } else {
    // 宽屏桌面端 (左右布局)
    padding = 40;
    // 左右布局中，棋盘最大可用宽度：总宽度减去侧边栏宽度 380px、外边距/间距 (左右 padding 64px + 间距 32px + 预留安全 24px = 120px)
    const maxH = width - 500;
    // vertical budget: Header (~80px) + CapturedPieces (~60px) + Layout Padding (~64px) + gaps + Coaching Banner (if active, ~60px)
    const verticalBudget = isCoachingActive ? 310 : 250;
    const maxV = height - verticalBudget;
    maxSize = Math.min(720, maxH, maxV);
  }

  // 保证合理的最小棋盘尺寸
  const size = Math.max(280, maxSize);
  return { size, padding };
};

const MAX_AI_RETRIES = 3

export function useChessGame(): UseChessGameResult & { boardSize: number; boardPadding: number } {
  const initialStore = useRef(loadStore())
  const [sessions, setSessions] = useState<GameSession[]>(initialStore.current.sessions)
  const [activeSessionId, setActiveSessionId] = useState(
    initialStore.current.activeSessionId ?? initialStore.current.sessions[0].id,
  )

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ?? sessions[0]

  const isCoachingActive = !!(activeSession?.isCoaching && activeSession?.coachingInstruction);

  const [boardConfig, setBoardConfig] = useState(() => getBoardConfig(isCoachingActive));

  useEffect(() => {
    const handleResize = () => {
      setBoardConfig(getBoardConfig(isCoachingActive));
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [isCoachingActive, activeSessionId]);

  const { size: BOARD_SIZE, padding: BOARD_PADDING } = boardConfig;

  const [aiThinking, setAiThinking] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [lastAiPrompt, setLastAiPrompt] = useState<string | null>(null)
  const [lastAiResponse, setLastAiResponse] = useState<string | null>(null)
  const [keyPieceAlert, setKeyPieceAlert] = useState<{ pieceName: string } | null>(null)
  const [pendingSnapshot, setPendingSnapshot] = useState<TacticalSnapshot | null>(null)
  const [activeHint, setActiveHint] = useState<{ fromRow: number; fromCol: number; toRow: number; toCol: number } | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<ZhChess | null>(null)
  const activeSessionIdRef = useRef(activeSessionId)
  const sessionsRef = useRef(sessions)
  const aiRunIdRef = useRef(0)
  const aiThinkingRef = useRef(false)
  const runAiTurnRef = useRef<() => Promise<void>>(async () => {})
  const lastCapturedMoveIndexRef = useRef<Record<string, number>>({})
  const previousSessionIdRef = useRef<string | null>(null)

  aiThinkingRef.current = aiThinking

  activeSessionIdRef.current = activeSessionId
  sessionsRef.current = sessions

  const persist = useCallback((nextSessions: GameSession[], nextActiveId: string) => {
    setSessions(nextSessions)
    setActiveSessionId(nextActiveId)
    sessionsRef.current = nextSessions
    
    // Filter out temporary practice sessions when persisting to localStorage
    const savedSessions = nextSessions.filter(s => !s.id.startsWith('practice-'))
    const savedActiveId = nextActiveId.startsWith('practice-')
      ? (savedSessions[0]?.id || '')
      : nextActiveId
    saveStore({ version: 1, activeSessionId: savedActiveId, sessions: savedSessions })
  }, [])

  const loadSessionOnBoard = useCallback((session: GameSession) => {
    const game = gameRef.current
    const canvas = canvasRef.current
    if (!game || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    applySessionToBoard(game, session, ctx)

    if (activeHint) {
      drawHint(
        ctx,
        activeHint.fromRow,
        activeHint.fromCol,
        activeHint.toRow,
        activeHint.toCol,
        session.boardVisualSide ?? session.playerSide,
        BOARD_SIZE,
        BOARD_PADDING
      )
    }
  }, [activeHint, BOARD_SIZE, BOARD_PADDING])

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

  const confirmPendingSnapshotWithType = useCallback((type: 'positive' | 'negative') => {
    if (!pendingSnapshot) return
    const gameId = pendingSnapshot.gameId
    lastCapturedMoveIndexRef.current[gameId] = pendingSnapshot.triggerMoveIndex

    const updatedSnapshot: TacticalSnapshot = {
      ...pendingSnapshot,
      type,
      triggerReason: pendingSnapshot.triggerReason === 'manual'
        ? (type === 'positive' ? '优势瞬间 (手动录入)' : '失误瞬间 (手动录入)')
        : pendingSnapshot.triggerReason
    }

    addSnapshot(updatedSnapshot)
    window.dispatchEvent(new CustomEvent('chess-snapshots-changed', { detail: { snapshot: updatedSnapshot } }))
    setPendingSnapshot(null)
    console.log(`[象棋·错题本] 用户手动确认录入 (${type})，成功添加快照！`)
  }, [pendingSnapshot])

  const confirmPendingSnapshot = useCallback(() => {
    if (!pendingSnapshot) return
    confirmPendingSnapshotWithType(pendingSnapshot.type)
  }, [pendingSnapshot, confirmPendingSnapshotWithType])

  const cancelPendingSnapshot = useCallback(() => {
    if (pendingSnapshot) {
      console.log('[象棋·错题本] 快照忽略/超时自动关闭:', pendingSnapshot.triggerReason)
      setPendingSnapshot(null)
    }
  }, [pendingSnapshot])

  const triggerManualSnapshot = useCallback((currentPly?: number) => {
    const session = sessionsRef.current.find((s) => s.id === activeSessionIdRef.current)
    if (!session) return
    if (session.moveHistory.length === 0) {
      console.log('[象棋·错题本] 暂无走子记录，无法录入快照')
      return
    }

    const triggerMoveIndex = (currentPly !== undefined && currentPly > 0)
      ? Math.min(currentPly - 1, session.moveHistory.length - 1)
      : session.moveHistory.length - 1

    // Extract last 10 plies ending at triggerMoveIndex
    const startIndex = Math.max(0, triggerMoveIndex - 9)
    const capturedSteps = session.moveHistory.slice(startIndex, triggerMoveIndex + 1)
    
    // Construct SnapshotStep array
    const steps = capturedSteps.map((m, idx) => ({
      ply: idx,
      side: m.side,
      penCode: m.penCode,
      notation: m.notation,
      evaluation: m.evaluation,
    }))

    // Determine startPen
    const startPen = startIndex === 0
      ? (session.initialPen ?? session.positionPen)
      : session.moveHistory[startIndex - 1].penCode

    // Dynamic Title Generation based on overall situation
    const currentMove = session.moveHistory[triggerMoveIndex]
    let dynamicTitle = session.title || '人机对弈'
    if (currentMove) {
      const ply = triggerMoveIndex + 1
      const sideText = currentMove.side === 'RED' ? '红方' : '黑方'
      let moveDesc = currentMove.notation
      if (currentMove.captured) {
        moveDesc += `(吃${currentMove.captured.displayName})`
      }
      
      const score = currentMove.evaluation !== undefined ? currentMove.evaluation : 0
      let advantageText = ''
      if (currentMove.inCheck) {
        advantageText = '将军防守'
      } else if (Math.abs(score) < 100) {
        advantageText = '均势抗衡'
      } else if (score > 800) {
        advantageText = '红大胜在望'
      } else if (score < -800) {
        advantageText = '黑攻势如潮'
      } else if (score > 250) {
        advantageText = '红主导攻势'
      } else if (score < -250) {
        advantageText = '黑占据主动'
      } else {
        advantageText = '暗流涌动'
      }

      if (currentMove.inCheck) {
        dynamicTitle = `第 ${ply} 步 - ${sideText}${moveDesc} [将军时刻]`
      } else if (currentMove.captured && ['车', '馬', '马', '炮'].includes(currentMove.captured.displayName)) {
        dynamicTitle = `第 ${ply} 步 - ${sideText}${moveDesc} [得子交锋]`
      } else {
        dynamicTitle = `第 ${ply} 步 - ${sideText}${moveDesc} [${advantageText}]`
      }
    }

    const snapshot: TacticalSnapshot = {
      id: `${session.id}-${triggerMoveIndex}-${Date.now()}`,
      timestamp: Date.now(),
      gameId: session.id,
      gameTitle: dynamicTitle,
      type: 'positive', // Default, will be updated based on user's choice
      triggerMoveIndex,
      triggerReason: 'manual',
      playerSide: session.playerSide,
      steps,
      startPen,
    }

    setPendingSnapshot(snapshot)
  }, [])



  const startSnapshotPractice = useCallback((snapshot: TacticalSnapshot) => {
    // Backup the current session ID
    if (!activeSessionIdRef.current.startsWith('practice-')) {
      previousSessionIdRef.current = activeSessionIdRef.current
    }

    // Create the temporary practice session
    const practiceId = `practice-${snapshot.id}-${Date.now()}`
    
    // Parse turn from the snapshot's startPen
    const penParts = snapshot.startPen.split(' ')
    const turnChar = penParts[1] || 'r'
    const startTurn: PieceSide = (turnChar === 'r' || turnChar === 'w') ? 'RED' : 'BLACK'

    const practiceSession: GameSession = {
      id: practiceId,
      title: `[练习] ${snapshot.gameTitle}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      playerSide: snapshot.playerSide,
      initialPen: snapshot.startPen,
      positionPen: snapshot.startPen,
      moveHistory: [],
      winner: null,
      status: 'active',
      currentTurn: startTurn,
      vsAi: true,
      isCoaching: true,
      coachingInstruction: snapshot.coachingHint || `AI 提示：此瞬间为${snapshot.type === 'positive' ? '优势瞬间' : '失误瞬间'}。当时触发走子为 "${snapshot.steps[snapshot.steps.length - 1]?.notation || ''}"。请重新练习本局！`
    }

    // Insert into sessions and switch
    const nextSessions = [practiceSession, ...sessionsRef.current.filter(s => !s.id.startsWith('practice-'))]
    persist(nextSessions, practiceId)
    
    // Switch on the board
    loadSessionOnBoard(practiceSession)
  }, [loadSessionOnBoard, persist])

  const exitSnapshotPractice = useCallback(() => {
    const backupId = previousSessionIdRef.current
    previousSessionIdRef.current = null

    // Remove temporary practice sessions
    const nextSessions = sessionsRef.current.filter(s => !s.id.startsWith('practice-'))
    
    let targetId = backupId && nextSessions.some(s => s.id === backupId) ? backupId : nextSessions[0]?.id
    if (!targetId) {
      // Fallback: create new session if empty
      const fallback = makeSession({ vsAi: true })
      nextSessions.push(fallback)
      targetId = fallback.id
    }

    persist(nextSessions, targetId)
    const targetSession = nextSessions.find(s => s.id === targetId)!
    loadSessionOnBoard(targetSession)
  }, [persist, loadSessionOnBoard])

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
          const { move, moveInfo, fullPrompt, rawContent, evaluation } = await requestAiMove({
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
            evaluation,
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

          // Update the human's last move in moveHistory with the evaluation score
          if (evaluation !== undefined) {
            setSessions((prev) => {
              const next = prev.map((s) => {
                if (s.id !== activeSessionIdRef.current) return s
                const history = [...s.moveHistory]
                const humanMoveIdx = history.length - 1
                if (humanMoveIdx >= 0 && history[humanMoveIdx].side === s.playerSide) {
                  history[humanMoveIdx] = {
                    ...history[humanMoveIdx],
                    evaluation,
                  }
                  
                  // Auto snapshot trigger on score delta is removed per user request (manual snapshot mode enabled).
                }
                return {
                  ...s,
                  moveHistory: history,
                }
              })
              sessionsRef.current = next
              saveStore({ version: 1, activeSessionId: activeSessionIdRef.current, sessions: next })
              return next
            })
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

  const clearHint = useCallback(() => {
    setActiveHint(null)
    const game = gameRef.current
    const canvas = canvasRef.current
    if (game && canvas) {
      const ctx = canvas.getContext('2d')
      const session = sessionsRef.current.find((s) => s.id === activeSessionIdRef.current)
      if (ctx && session) {
        applySessionToBoard(game, session, ctx)
      }
    }
  }, [])

  const showHint = useCallback((type: 'offensive' | 'defensive') => {
    const session = sessionsRef.current.find((s) => s.id === activeSessionIdRef.current)
    if (!session) return

    // 1. Immediately set aiThinking to true to block clicks and provide visual feedback
    setAiThinking(true)

    // 2. Perform engine search after a 600ms delay to feel realistic and premium
    setTimeout(() => {
      const fen = session.positionPen
      const board = Board.fromFen(fen)
      const side = board.sideToMove

      // Generate legal moves
      const legalMoves = board.generateLegalMoves()
      if (legalMoves.length === 0) {
        setAiThinking(false)
        return
      }

      // Filter moves based on type
      const filteredMoves = legalMoves.filter(move => {
        const piece = board.getPiece(move.from_row, move.from_col)
        if (piece === null) return false
        
        const pieceType = piece.toUpperCase()
        if (type === 'offensive') {
          return pieceType === 'R' || pieceType === 'N' || pieceType === 'C'
        } else {
          return pieceType === 'A' || pieceType === 'B'
        }
      })

      if (filteredMoves.length === 0) {
        console.log(`[象棋·提示] 暂无符合条件的${type === 'offensive' ? '进攻性' : '防御性'}合法走法`)
        setAiThinking(false)
        return
      }

      // Run an Alpha-Beta search using the user's selected engine difficulty depth
      let bestMove: Move | null = null
      let bestScore = side === 'w' ? -Infinity : Infinity

      const depth = session.engineDepth ?? 4
      const searcher = new AlphaBetaSearch(depth)

      for (const move of filteredMoves) {
        const newBoard = board.makeMove(move)
        const [, score] = searcher.search(newBoard, 0.4)

        if (side === 'w') {
          if (score > bestScore) {
            bestScore = score
            bestMove = move
          }
        } else {
          if (score < bestScore) {
            bestScore = score
            bestMove = move
          }
        }
      }

      if (bestMove) {
        console.log(`[象棋·提示] 推荐的${type === 'offensive' ? '进攻' : '防守'}走子:`, bestMove)
        setActiveHint({
          fromRow: bestMove.from_row,
          fromCol: bestMove.from_col,
          toRow: bestMove.to_row,
          toCol: bestMove.to_col
        })

        // Redraw board and overlay immediately
        const game = gameRef.current
        const canvas = canvasRef.current
        if (game && canvas) {
          const ctx = canvas.getContext('2d')
          if (ctx) {
            // 1. Redraw base board
            applySessionToBoard(game, session, ctx)
            // 2. Draw overlay
            drawHint(
              ctx,
              bestMove.from_row,
              bestMove.from_col,
              bestMove.to_row,
              bestMove.to_col,
              session.boardVisualSide ?? session.playerSide,
              BOARD_SIZE,
              BOARD_PADDING
            )
          }
        }
      }

      // 3. Clear thinking state once complete
      setAiThinking(false)
    }, 600)
  }, [BOARD_SIZE, BOARD_PADDING])

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
      setActiveHint(null)
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
    setActiveHint(null)
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
      patchActiveSession({ playerSide: side, boardVisualSide: side })
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
    setActiveHint(null)

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

  const rollbackToPly = useCallback((targetPly: number) => {
    const session = sessionsRef.current.find((s) => s.id === activeSessionIdRef.current)
    if (!session) return
    if (targetPly < 0 || targetPly > session.moveHistory.length) return
    if (aiThinkingRef.current) return

    setKeyPieceAlert(null)
    setAiError(null)
    aiRunIdRef.current++

    const newHistory = session.moveHistory.slice(0, targetPly)
    
    // Determine the FEN state at targetPly
    const newPen = targetPly === 0
      ? (session.initialPen ?? 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w')
      : session.moveHistory[targetPly - 1].penCode

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

    const updatedSession = { 
      ...session, 
      moveHistory: newHistory, 
      positionPen: newPen, 
      currentTurn: newTurn, 
      winner: null, 
      status: 'active' as const 
    }
    queueMicrotask(() => loadSessionOnBoard(updatedSession))
  }, [patchActiveSession, loadSessionOnBoard])

  const startNewGame = useCallback(() => {
    const game = gameRef.current
    const canvas = canvasRef.current
    const session = sessionsRef.current.find((s) => s.id === activeSessionIdRef.current)
    if (!game || !canvas || !session) return

    setAiError(null)
    aiRunIdRef.current++
    setActiveHint(null)

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
      boardVisualSide: side,
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

    const session = makeSession({
      vsAi: true,
      title: `${scenario.title}`,
      positionPen: scenario.initial_pen,
      coachingInstruction: scenario.instruction,
      playerSide: turn
    })

    session.isCoaching = true
    session.status = 'active'
    session.currentTurn = turn

    const next = [session, ...sessionsRef.current]
    persist(next, session.id)
    loadSessionOnBoard(session)
  }, [loadSessionOnBoard, persist])

  const flipBoard = useCallback(() => {
    const session = sessionsRef.current.find((s) => s.id === activeSessionIdRef.current)
    if (!session) return

    const newPlayerSide: PieceSide = session.playerSide === 'RED' ? 'BLACK' : 'RED'
    
    // 1. Update only playerSide in state and store (keep boardVisualSide stable!)
    patchActiveSession({ playerSide: newPlayerSide })

    // 2. Decouple visual board orientation from playerSide during the role swap
    const game = gameRef.current
    if (game) {
      const internal = game as unknown as { gameSide: PieceSide | null }
      internal.gameSide = newPlayerSide
      
      const visualSide = session.boardVisualSide ?? session.playerSide
      game.changePlaySide(visualSide)
      
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) game.draw(ctx)
    }

    // 3. If vs AI and the new player side makes it the AI's turn, trigger the AI!
    if (session.vsAi && !session.winner && session.status === 'active') {
      const aiSide = newPlayerSide === 'RED' ? 'BLACK' : 'RED'
      if (session.currentTurn === aiSide) {
        console.log(`[象棋·换边] 玩家由 ${session.playerSide} 换为 ${newPlayerSide}。现在轮到 AI (${aiSide}) 走子！`)
        setAiThinking(true)
        setTimeout(() => {
          void runAiTurnRef.current()
        }, 50)
      }
    }
  }, [patchActiveSession])

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
        if (session && session.vsAi) {
          if (mover !== session.playerSide && captured.side === session.playerSide) {
            if (['车', '马', '炮'].includes(captured.displayName)) {
              setKeyPieceAlert({ pieceName: captured.displayName })
            }
          }

          // Auto snapshot trigger on key piece capture is removed per user request (manual snapshot mode enabled).
        }
      }

      setActiveHint(null)

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

      setActiveHint(null)

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
  }, [maybeRequestAi, BOARD_SIZE, BOARD_PADDING])

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
    startSnapshotPractice,
    exitSnapshotPractice,
    pendingSnapshot,
    confirmPendingSnapshot,
    confirmPendingSnapshotWithType,
    cancelPendingSnapshot,
    triggerManualSnapshot,
    rollbackToPly,
    boardSize: BOARD_SIZE,
    boardPadding: BOARD_PADDING,
    activeHint,
    showHint,
    clearHint,
  }
}

/**
 * 战术建议路径绘制引擎 (Rule Engine Visual Overlay)
 * 
 * 在棋盘 Canvas 上绘制极具现代科技感的金色/绿色高亮环及路线箭头，给玩家进攻或防御性的精妙建议。
 */
function drawHint(
  ctx: CanvasRenderingContext2D,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  visualSide: 'RED' | 'BLACK',
  boardSize: number,
  boardPadding: number
) {
  const width = boardSize - 2 * boardPadding
  const height = boardSize - 2 * boardPadding
  const cellWidth = width / 8
  const cellHeight = height / 9

  const getCoords = (r: number, c: number) => {
    if (visualSide === 'BLACK') {
      return {
        x: boardPadding + (8 - c) * cellWidth,
        y: boardPadding + (9 - r) * cellHeight
      }
    } else {
      return {
        x: boardPadding + c * cellWidth,
        y: boardPadding + r * cellHeight
      }
    }
  }

  const start = getCoords(fromRow, fromCol)
  const end = getCoords(toRow, toCol)
  const pieceRadius = cellWidth * 0.45

  // 1. 绘制起始棋子金色外发光圈
  ctx.save()
  ctx.beginPath()
  ctx.arc(start.x, start.y, pieceRadius + 5, 0, 2 * Math.PI)
  ctx.strokeStyle = '#d97706' // 温暖琥珀金
  ctx.lineWidth = 4
  ctx.shadowColor = '#fbbf24'
  ctx.shadowBlur = 10
  ctx.stroke()
  ctx.restore()

  // 2. 绘制目的地方向绿色虚线准星圈
  ctx.save()
  ctx.beginPath()
  ctx.arc(end.x, end.y, pieceRadius * 0.7, 0, 2 * Math.PI)
  ctx.strokeStyle = '#10b981' // 翡翠绿
  ctx.lineWidth = 3
  ctx.setLineDash([4, 4])
  ctx.shadowColor = '#34d399'
  ctx.shadowBlur = 8
  ctx.stroke()
  ctx.restore()

  // 绘制中心靶心小实心点
  ctx.save()
  ctx.beginPath()
  ctx.arc(end.x, end.y, 4, 0, 2 * Math.PI)
  ctx.fillStyle = '#10b981'
  ctx.fill()
  ctx.restore()

  // 3. 绘制带有发光箭头的淡蓝色行动导引路径
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(start.x, start.y)
  ctx.lineTo(end.x, end.y)
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)' // 亮蓝色
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.setLineDash([6, 6])
  ctx.shadowColor = '#60a5fa'
  ctx.shadowBlur = 6
  ctx.stroke()

  // 绘制末梢箭头
  const angle = Math.atan2(end.y - start.y, end.x - start.x)
  const arrowLength = 12
  ctx.beginPath()
  ctx.moveTo(end.x - pieceRadius * 0.75 * Math.cos(angle), end.y - pieceRadius * 0.75 * Math.sin(angle))
  ctx.lineTo(
    end.x - pieceRadius * 0.75 * Math.cos(angle) - arrowLength * Math.cos(angle - Math.PI / 6),
    end.y - pieceRadius * 0.75 * Math.sin(angle) - arrowLength * Math.sin(angle - Math.PI / 6)
  )
  ctx.lineTo(
    end.x - pieceRadius * 0.75 * Math.cos(angle) - arrowLength * Math.cos(angle + Math.PI / 6),
    end.y - pieceRadius * 0.75 * Math.sin(angle) - arrowLength * Math.sin(angle + Math.PI / 6)
  )
  ctx.closePath()
  ctx.fillStyle = 'rgba(59, 130, 246, 0.95)'
  ctx.fill()
  ctx.restore()
}
