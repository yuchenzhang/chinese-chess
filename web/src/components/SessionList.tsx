import { useState } from 'react'
import type { GameSession } from '../types/gameSession'

interface SessionListProps {
  sessions: GameSession[]
  activeSessionId: string
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
}

function sessionSummary(session: GameSession): string {
  if (session.isCoaching) return '教练训练'
  if (!session.vsAi) return '未启用人机'
  if (session.status === 'setup') return '未开始'
  if (session.winner) {
    const label = session.winner === session.playerSide ? '你胜' : 'AI胜'
    return label
  }
  const n = session.moveHistory.length
  return n > 0 ? `${n} 手` : '进行中'
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SessionList({
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
}: SessionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const startRename = (session: GameSession) => {
    setEditingId(session.id)
    setEditTitle(session.title)
  }

  const commitRename = (id: string) => {
    onRename(id, editTitle)
    setEditingId(null)
  }

  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <section className="card session-card">
      <div className="session-card-head">
        <h2>棋局</h2>
        <button type="button" className="btn btn-sm primary" onClick={onCreate}>
          + 新棋局
        </button>
      </div>
      
      <ul className="session-list">
        {sorted.map((session) => {
          const isActive = session.id === activeSessionId
          return (
            <li key={session.id} className={`${isActive ? 'session-item active' : 'session-item'}${session.isCoaching ? ' coaching-session' : ''}`}>
              {editingId === session.id ? (
                <input
                  className="session-rename-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => commitRename(session.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(session.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  className="session-select"
                  onClick={() => onSelect(session.id)}
                  onDoubleClick={() => startRename(session)}
                >
                  <span className="session-title">
                    {session.isCoaching && <span style={{ marginRight: '4px' }}>🎓</span>}
                    {session.title}
                  </span>
                  <span className="session-meta">
                    {session.vsAi && !session.isCoaching && (
                      <span className="session-badge session-badge-ai">人机</span>
                    )}
                    <span className={`session-badge${session.isCoaching ? ' session-badge-coaching' : ''}`}>{sessionSummary(session)}</span>
                    <time dateTime={new Date(session.updatedAt).toISOString()}>
                      {formatTime(session.updatedAt)}
                    </time>
                  </span>
                </button>
              )}
              <button
                type="button"
                className="btn-icon"
                title="删除棋局"
                aria-label={`删除 ${session.title}`}
                onClick={() => {
                  if (sessions.length <= 1) {
                    if (!confirm('删除最后一局将新建空棋局，确定？')) return
                  } else if (!confirm(`删除「${session.title}」？`)) {
                    return
                  }
                  onDelete(session.id)
                }}
              >
                ×
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

