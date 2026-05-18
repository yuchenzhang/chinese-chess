import { initBoardPen } from 'zh-chess'
import type { GameSession, SessionStore } from '../types/gameSession'

const STORAGE_KEY = 'chinese-chess:sessions:v1'

function newId(): string {
  return crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function defaultSessionTitle(date = new Date()): string {
  return `对局 ${date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

export function createSession(partial?: Partial<Pick<GameSession, 'title' | 'playerSide'>>): GameSession {
  const now = Date.now()
  return {
    id: newId(),
    title: partial?.title ?? defaultSessionTitle(),
    createdAt: now,
    updatedAt: now,
    playerSide: partial?.playerSide ?? 'RED',
    positionPen: initBoardPen,
    moveHistory: [],
    winner: null,
    status: 'setup',
    currentTurn: null,
  }
}

export function loadStore(): SessionStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const session = createSession()
      return { version: 1, activeSessionId: session.id, sessions: [session] }
    }
    const parsed = JSON.parse(raw) as SessionStore
    if (parsed.version !== 1 || !Array.isArray(parsed.sessions)) {
      throw new Error('invalid store')
    }
    if (parsed.sessions.length === 0) {
      const session = createSession()
      return { version: 1, activeSessionId: session.id, sessions: [session] }
    }
    if (!parsed.activeSessionId || !parsed.sessions.some((s) => s.id === parsed.activeSessionId)) {
      parsed.activeSessionId = parsed.sessions[0].id
    }
    parsed.sessions = parsed.sessions.map((s) => ({
      ...s,
      currentTurn: s.currentTurn ?? null,
    }))
    return parsed
  } catch {
    const session = createSession()
    return { version: 1, activeSessionId: session.id, sessions: [session] }
  }
}

export function saveStore(store: SessionStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}
