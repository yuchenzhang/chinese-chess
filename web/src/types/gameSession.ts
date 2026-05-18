import type { PieceSide } from 'zh-chess'

export type GameSessionStatus = 'setup' | 'active' | 'finished'

export interface MoveRecord {
  side: PieceSide
  penCode: string
  inCheck: boolean
}

export interface GameSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  playerSide: PieceSide
  /** 当前局面 PEN（含行棋方） */
  positionPen: string
  moveHistory: MoveRecord[]
  winner: PieceSide | null
  status: GameSessionStatus
  /** 当前行棋方；未开局或已结束为 null */
  currentTurn: PieceSide | null
}

export interface SessionStore {
  version: 1
  activeSessionId: string | null
  sessions: GameSession[]
}
