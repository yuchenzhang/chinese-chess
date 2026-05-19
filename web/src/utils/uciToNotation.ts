import { parse_PEN_Str, type PieceSide } from 'zh-chess'
import { moveToNotation } from './notation'

export interface UciMoveInfo {
  notation: string
  fromX: number
  fromY: number
  toX: number
  toY: number
}

/**
 * Converts a UCI move (e.g., "h2e2") to Chinese notation and coordinate info.
 */
export function uciToNotation(pen: string, uci: string): UciMoveInfo {
  // 1. Parse UCI
  const cols = 'abcdefghi'
  const fromX = cols.indexOf(uci[0])
  const fromY = 9 - parseInt(uci[1], 10)
  const toX = cols.indexOf(uci[2])
  const toY = 9 - parseInt(uci[3], 10)

  if (fromX === -1 || toX === -1 || isNaN(fromY) || isNaN(toY)) {
    return { notation: uci, fromX, fromY, toX, toY }
  }

  // 2. Parse PEN to find the piece at fromX, fromY
  const parsed = parse_PEN_Str(pen)
  const piece = parsed.list.find((p: any) => p.x === fromX && p.y === fromY)

  if (!piece) {
    console.warn(`No piece found at UCI origin ${uci[0]}${uci[1]} (${fromX}, ${fromY})`)
    return { notation: uci, fromX, fromY, toX, toY }
  }

  // 3. Convert to notation
  const notation = moveToNotation(
    { name: piece.name, x: fromX, y: fromY },
    { x: toX, y: toY },
    piece.side as PieceSide,
    false
  )

  console.log(`[象棋·DEBUG] UCI ${uci} -> Notation: ${notation}`, {
    pieceName: piece.name,
    from: { x: fromX, y: fromY },
    to: { x: toX, y: toY },
    side: piece.side
  })

  return { notation, fromX, fromY, toX, toY }
}

/**
 * Normalizes a PEN/FEN string for the Python engine.
 */
export function normalizeFenForEngine(pen: string): string {
  const parts = pen.split(' ')
  if (parts.length < 2) return pen

  let side = parts[1].toLowerCase()
  if (side === 'red' || side === 'r' || side === 'w') {
    side = 'w'
  } else if (side === 'black' || side === 'b') {
    side = 'b'
  }

  parts[1] = side
  return parts.join(' ')
}
