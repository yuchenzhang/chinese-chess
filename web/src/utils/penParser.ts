import type { PieceSide } from 'zh-chess'

export interface PenPieceInfo {
  name: string
  side: PieceSide
  /** Simplified display name (e.g. 車→车, 砲→炮) */
  displayName: string
}

const PEN_CHAR_MAP: Record<string, PenPieceInfo> = {
  R: { name: '車', side: 'RED', displayName: '车' },
  N: { name: '馬', side: 'RED', displayName: '马' },
  B: { name: '相', side: 'RED', displayName: '相' },
  A: { name: '仕', side: 'RED', displayName: '仕' },
  K: { name: '帅', side: 'RED', displayName: '帅' },
  C: { name: '炮', side: 'RED', displayName: '炮' },
  P: { name: '兵', side: 'RED', displayName: '兵' },
  r: { name: '车', side: 'BLACK', displayName: '车' },
  n: { name: '马', side: 'BLACK', displayName: '马' },
  b: { name: '象', side: 'BLACK', displayName: '象' },
  a: { name: '士', side: 'BLACK', displayName: '士' },
  k: { name: '将', side: 'BLACK', displayName: '将' },
  c: { name: '砲', side: 'BLACK', displayName: '炮' },
  p: { name: '卒', side: 'BLACK', displayName: '卒' },
}

/** Piece value for evaluating notable moves */
const PIECE_VALUE: Record<string, number> = {
  R: 9, r: 9,   // 车 - highest value
  C: 4, c: 4,   // 炮
  N: 4, n: 4,   // 马
  A: 2, a: 2,   // 仕/士
  B: 2, b: 2,   // 相/象
  P: 1, p: 1,   // 兵/卒
  K: 99, k: 99, // 帅/将
}

/**
 * Parse a PEN string into a 10x9 board grid (row-major).
 * Returns the character at each position.
 * board[y][x] where y=0 is top (Black's back rank), y=9 is bottom (Red's back rank).
 */
export function parsePenToBoard(pen: string): (string | null)[][] {
  const boardPart = pen.split(' ')[0]
  const rows = boardPart.split('/')
  const board: (string | null)[][] = []

  for (const row of rows) {
    const cells: (string | null)[] = []
    for (const ch of row) {
      const num = parseInt(ch)
      if (!isNaN(num)) {
        for (let i = 0; i < num; i++) cells.push(null)
      } else {
        cells.push(ch)
      }
    }
    board.push(cells)
  }

  return board
}

/**
 * Find piece info at given board coordinates from a PEN string.
 * Coordinates: x=0..8 (left to right), y=0..9 (top to bottom).
 */
export function getPieceAtPosition(pen: string, x: number, y: number): PenPieceInfo | null {
  const board = parsePenToBoard(pen)
  if (y < 0 || y >= board.length) return null
  const row = board[y]
  if (x < 0 || x >= row.length) return null
  const ch = row[x]
  if (!ch) return null
  return PEN_CHAR_MAP[ch] ?? null
}

/**
 * Get the PEN character at a given position.
 */
export function getPenCharAtPosition(pen: string, x: number, y: number): string | null {
  const board = parsePenToBoard(pen)
  if (y < 0 || y >= board.length) return null
  const row = board[y]
  if (x < 0 || x >= row.length) return null
  return row[x]
}

/**
 * Get the value of a piece from its PEN character.
 */
export function getPieceValue(penChar: string): number {
  return PIECE_VALUE[penChar] ?? 0
}

/**
 * Count pieces that a piece at (x,y) threatens in the given position.
 * Returns threatened enemy pieces (simplified: only checks for rook/cannon/horse attacks).
 * This is a heuristic for detecting forks and notable moves.
 */
export function countThreatenedPieces(
  pen: string,
  pieceX: number,
  pieceY: number,
  pieceSide: PieceSide,
): PenPieceInfo[] {
  const board = parsePenToBoard(pen)
  const penChar = board[pieceY]?.[pieceX]
  if (!penChar) return []

  const threatened: PenPieceInfo[] = []
  const enemySide: PieceSide = pieceSide === 'RED' ? 'BLACK' : 'RED'
  const upperChar = penChar.toUpperCase()

  if (upperChar === 'R') {
    // Rook: threatens along ranks and files
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]]
    for (const [dx, dy] of dirs) {
      let nx = pieceX + dx, ny = pieceY + dy
      while (nx >= 0 && nx <= 8 && ny >= 0 && ny <= 9) {
        const target = board[ny]?.[nx]
        if (target) {
          const info = PEN_CHAR_MAP[target]
          if (info && info.side === enemySide) {
            threatened.push(info)
          }
          break
        }
        nx += dx
        ny += dy
      }
    }
  } else if (upperChar === 'N') {
    // Horse: L-shaped moves, checking for leg obstruction
    const horseMoves = [
      { dx: 1, dy: 2, legX: 0, legY: 1 },
      { dx: -1, dy: 2, legX: 0, legY: 1 },
      { dx: 1, dy: -2, legX: 0, legY: -1 },
      { dx: -1, dy: -2, legX: 0, legY: -1 },
      { dx: 2, dy: 1, legX: 1, legY: 0 },
      { dx: -2, dy: 1, legX: -1, legY: 0 },
      { dx: 2, dy: -1, legX: 1, legY: 0 },
      { dx: -2, dy: -1, legX: -1, legY: 0 },
    ]
    for (const { dx, dy, legX, legY } of horseMoves) {
      const legBlockX = pieceX + legX, legBlockY = pieceY + legY
      if (board[legBlockY]?.[legBlockX]) continue // leg blocked
      const nx = pieceX + dx, ny = pieceY + dy
      if (nx < 0 || nx > 8 || ny < 0 || ny > 9) continue
      const target = board[ny]?.[nx]
      if (target) {
        const info = PEN_CHAR_MAP[target]
        if (info && info.side === enemySide) {
          threatened.push(info)
        }
      }
    }
  } else if (upperChar === 'C') {
    // Cannon: threatens with exactly one piece in between (screen)
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]]
    for (const [dx, dy] of dirs) {
      let nx = pieceX + dx, ny = pieceY + dy
      let screenFound = false
      while (nx >= 0 && nx <= 8 && ny >= 0 && ny <= 9) {
        const target = board[ny]?.[nx]
        if (target) {
          if (!screenFound) {
            screenFound = true
          } else {
            const info = PEN_CHAR_MAP[target]
            if (info && info.side === enemySide) {
              threatened.push(info)
            }
            break
          }
        }
        nx += dx
        ny += dy
      }
    }
  }

  return threatened
}

/**
 * Determine if a move is "notable" (妙手).
 * Heuristics:
 * - Fork: piece threatens 2+ valuable enemy pieces (value >= 4, i.e. horse/cannon/rook)
 * - Capturing a rook (highest value piece)
 */
export function isNotableMove(
  penAfterMove: string,
  movedPieceX: number,
  movedPieceY: number,
  movedPieceSide: PieceSide,
  capturedPenChar: string | null,
): { notable: boolean; reason?: string } {
  // Capturing a rook is always notable
  if (capturedPenChar && (capturedPenChar === 'R' || capturedPenChar === 'r')) {
    return { notable: true, reason: '得车' }
  }

  // Check for fork (threatening 2+ valuable pieces)
  const threatened = countThreatenedPieces(penAfterMove, movedPieceX, movedPieceY, movedPieceSide)
  const valuableThreats = threatened.filter(p => {
    const ch = Object.entries(PEN_CHAR_MAP).find(([, v]) => v === p)?.[0]
    return ch ? getPieceValue(ch) >= 4 : false
  })

  if (valuableThreats.length >= 2) {
    const names = valuableThreats.map(p => p.displayName).join('')
    return { notable: true, reason: `捉双${names}` }
  }

  return { notable: false }
}
