import type { MoveRecord, CapturedPieceInfo } from '../types/gameSession'

interface CapturedPiecesProps {
  moveHistory: MoveRecord[]
  /** When in replay mode, only show captures up to this ply (1-indexed). undefined = show all. */
  maxPly?: number
}

function groupCaptured(captures: CapturedPieceInfo[]): Map<string, { piece: CapturedPieceInfo; count: number }> {
  const groups = new Map<string, { piece: CapturedPieceInfo; count: number }>()
  for (const cap of captures) {
    const key = `${cap.side}-${cap.displayName}`
    const existing = groups.get(key)
    if (existing) {
      existing.count++
    } else {
      groups.set(key, { piece: cap, count: 1 })
    }
  }
  return groups
}

export function CapturedPieces({ moveHistory, maxPly }: CapturedPiecesProps) {
  const redCaptured: CapturedPieceInfo[] = []
  const blackCaptured: CapturedPieceInfo[] = []

  const limit = maxPly !== undefined ? maxPly : moveHistory.length
  for (let i = 0; i < limit && i < moveHistory.length; i++) {
    const move = moveHistory[i]
    if (move.captured) {
      if (move.captured.side === 'RED') {
        redCaptured.push(move.captured)
      } else {
        blackCaptured.push(move.captured)
      }
    }
  }

  if (redCaptured.length === 0 && blackCaptured.length === 0) {
    return null
  }

  const redGroups = groupCaptured(redCaptured)
  const blackGroups = groupCaptured(blackCaptured)

  return (
    <div className="captured-pieces">
      {blackCaptured.length > 0 && (
        <div className="captured-row">
          <span className="captured-label">黑方损失:</span>
          <div className="captured-list">
            {Array.from(blackGroups.values()).map(({ piece, count }) => (
              <span key={`black-${piece.displayName}`} className="captured-piece captured-piece-black">
                {piece.displayName}
                {count > 1 && <sup className="captured-count">×{count}</sup>}
              </span>
            ))}
          </div>
        </div>
      )}
      {redCaptured.length > 0 && (
        <div className="captured-row">
          <span className="captured-label">红方损失:</span>
          <div className="captured-list">
            {Array.from(redGroups.values()).map(({ piece, count }) => (
              <span key={`red-${piece.displayName}`} className="captured-piece captured-piece-red">
                {piece.displayName}
                {count > 1 && <sup className="captured-count">×{count}</sup>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
