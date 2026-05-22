import type { PieceSide } from 'zh-chess'

export type GameSessionStatus = 'setup' | 'active' | 'finished'

export interface CapturedPieceInfo {
  /** Piece name as used by zh-chess engine */
  name: string
  /** Which side the captured piece belonged to */
  side: PieceSide
  /** Simplified display name (e.g. 車→车) */
  displayName: string
}

export interface MoveRecord {
  side: PieceSide
  /** 当前局面 PEN */
  penCode: string
  /** 中文记谱（如 "炮二平五"） */
  notation: string
  inCheck: boolean
  /** Captured piece info (if this move was a capture) */
  captured?: CapturedPieceInfo
  /** Whether this is a notable/brilliant move (妙手) */
  isNotable?: boolean
  /** Reason for being notable (e.g. "捉双车炮", "得车") */
  notableReason?: string
  /** 局势评估分值（绝对分值，红正黑负） */
  evaluation?: number
}

export interface SnapshotStep {
  ply: number
  side: PieceSide
  penCode: string
  notation: string
  evaluation?: number
}

export interface TacticalSnapshot {
  id: string
  timestamp: number
  gameId: string
  gameTitle: string
  type: 'positive' | 'negative' // 'positive' for 优势瞬间, 'negative' for 失误瞬间
  triggerMoveIndex: number // 触发该瞬间的走子在 moveHistory 中的索引
  triggerReason: string // 触发原因描述
  playerSide: PieceSide
  steps: SnapshotStep[]
  startPen: string // 10步（5轮）之前的局势 PEN，作为练习的起点
  coachingHint?: string // 大模型的指导性建议（导入后填充）
}

export interface GameSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  playerSide: PieceSide
  /** 初始局面 PEN */
  initialPen?: string
  /** 当前局面 PEN（含行棋方） */
  positionPen: string
  moveHistory: MoveRecord[]
  winner: PieceSide | null
  status: GameSessionStatus
  /** 当前行棋方；未开局或已结束为 null */
  currentTurn: PieceSide | null
  /** 是否与本盘对大模型（人机对弈） */
  vsAi: boolean
  /** 本地引擎思考层数（难度），默认4 */
  engineDepth?: number
  /** AI 教练指导文字（针对特定习题/残局/战术练习） */
  coachingInstruction?: string
  /** 是否为教练/战术瞬间对局 */
  isCoaching?: boolean
}

export interface SessionStore {
  version: 1
  activeSessionId: string | null
  sessions: GameSession[]
}
