/**
 * Headless zh-chess: parse PEN and compute all legal moves for a given side.
 * Uses only the logical API (no Canvas).
 */
import {
  parse_PEN_Str,
  chessOfPeiceMap,
  initBoardPen,
  type PieceList,
  type PeicePosInfo,
  type PieceSide,
  type Point,
} from 'zh-chess'

export interface LegalMove {
  pieceName: string    // e.g. "炮", "车"
  fromX: number
  fromY: number
  toX: number
  toY: number
  notation: string     // Chinese notation like "炮二平五"
}

/**
 * Parse a PEN string and return all legal moves for the given side.
 */
export function getLegalMovesFromPen(penStr: string, side: PieceSide): LegalMove[] {
  const parsed = parse_PEN_Str(penStr)
  const pieceList = parsed.list.map((p: PeicePosInfo) =>
    chessOfPeiceMap[p.name]({
      side: p.side,
      name: p.name,
      x: p.x,
      y: p.y,
      isLastMove: p.isLastMove ?? false,
    }),
  ) as PieceList

  const moves: LegalMove[] = []

  for (const piece of pieceList) {
    if (piece.side !== side) continue
    const movePoints = piece.getMovePoints(pieceList)
    for (const mp of movePoints) {
      const notation = moveToNotation(piece, mp, side)
      moves.push({
        pieceName: piece.name,
        fromX: piece.x,
        fromY: piece.y,
        toX: mp.x,
        toY: mp.y,
        notation,
      })
    }
  }

  return moves
}

/**
 * Convert a move to Chinese notation (e.g., "炮二平五").
 *
 * NOTE: The zh-chess engine's moveStrAsync method expects BOTH Red and Black
 * to use the same file numbering system: 1-9 from RIGHT to LEFT (Col 8 to 0).
 */
function moveToNotation(piece: { name: string; x: number; y: number }, to: Point, side: PieceSide): string {
  const { name: pieceName, x: fromX, y: fromY } = piece

  // BOTH sides use 9 - x to match zh-chess engine expectation
  const fromFile = 9 - fromX

  const dy = to.y - fromY
  const isHorizontal = dy === 0

  // RED moves forward = y decreases; BLACK moves forward = y increases
  const isForward = side === 'RED' ? dy < 0 : dy > 0

  let direction: string
  let dest: string

  if (isHorizontal) {
    direction = '平'
    const toFile = 9 - to.x
    dest = cnNum(toFile)
  } else {
    direction = isForward ? '进' : '退'
    // Linear pieces (车炮兵卒帅将): use step count
    // Non-linear (马相士): use destination file
    const isLinear = ['车', '炮', '兵', '卒', '帅', '将', '砲', '車', '馬', '象', '仕', '將', '帥'].includes(pieceName)
    if (isLinear) {
      dest = cnNum(Math.abs(dy))
    } else {
      const toFile = 9 - to.x
      dest = cnNum(toFile)
    }
  }

  return `${pieceName}${cnNum(fromFile)}${direction}${dest}`
}

const CN_NUMS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
function cnNum(n: number): string {
  return CN_NUMS[n] ?? String(n)
}

/**
 * Try to match a LLM response move string against a list of legal moves.
 * Handles character variations (traditional/simplified, full-width numbers).
 */
export function findLegalMove(notations: LegalMove[], llmMove: string): LegalMove | undefined {
  const normalized = normalizeNotation(llmMove)

  // Exact match
  for (const n of notations) {
    if (normalizeNotation(n.notation) === normalized) return n
  }

  // Fuzzy: substring match
  for (const n of notations) {
    const nn = normalizeNotation(n.notation)
    if (nn.includes(normalized) || normalized.includes(nn)) return n
  }

  return undefined
}

function normalizeNotation(s: string): string {
  return s
    .replace(/[０-９]/g, c => String(c.charCodeAt(0) - 0xFF10 + 0x30)) // full-width → half-width
    .replace(/砲/g, '炮')
    .replace(/車/g, '车')
    .replace(/馬/g, '马')
    .replace(/象/g, '相')
    .replace(/士/g, '仕')
    .replace(/將/g, '将')
    .replace(/帥/g, '帅')
    // Normalize Chinese numerals to Arabic (both sides use 1-9)
    .replace(/一/g, '1')
    .replace(/二/g, '2')
    .replace(/三/g, '3')
    .replace(/四/g, '4')
    .replace(/五/g, '5')
    .replace(/六/g, '6')
    .replace(/七/g, '7')
    .replace(/八/g, '8')
    .replace(/九/g, '9')
    .trim()
}

/** Convert zh-chess piece name to zh-chess moveStrAsync-compatible notation.
 * zh-chess expects specific characters:
 * Red: 帥, 仕, 象, 傌, 俥, 炮, 兵
 * Black: 將, 士, 象, 馬, 車, 砲, 卒
 * Actually, zh-chess internally uses:
 * Red: 帥, 仕, 相, 傌, 俥, 炮, 兵
 * Black: 將, 士, 象, 馬, 車, 砲, 卒
 * Note: zh-chess engine uses traditional for some, simplified for others.
 * Let's be exhaustive based on what zh-chess uses in its piece names.
 */
export function toMoveStr(notation: string): string {
  // zh-chess internally uses specific characters for piece identification in moveStrAsync.
  // We need to map common variations to the ones it expects.
  return notation
    .replace(/炮/g, '砲')
    .replace(/车/g, '車')
    .replace(/马/g, '馬')
    .replace(/相/g, '象') // Red '相' maps to '象' internally for moves
    .replace(/仕/g, '士') // Red '仕' maps to '士' internally for moves
    .replace(/帅/g, '帥')
    .replace(/将/g, '將')
}

/**
 * Get all unique notations for a side (useful for checking if LLM response is any legal move).
 */
export function getLegalMoveNotations(penStr: string, side: PieceSide): string[] {
  return getLegalMovesFromPen(penStr, side).map(m => m.notation)
}

/**
 * Render the board as a visual text diagram from PEN.
 * Top = row 0 (Black side), Bottom = row 9 (Red side).
 */
export function renderBoardAsText(penStr: string): string {
  const parsed = parse_PEN_Str(penStr)

  // Build 10x9 grid (row, col)
  const grid: string[][] = Array.from({ length: 10 }, () => Array(9).fill(' '))

  for (const p of parsed.list) {
    // Use traditional Chinese piece names for display
    const label = p.side === 'RED'
      ? p.name.replace(/砲/g, '炮').replace(/車/g, '车').replace(/馬/g, '马').replace(/象/g, '相').replace(/士/g, '仕').replace(/帥/g, '帅')
      : p.name
    grid[p.y][p.x] = label
  }

  const filesLabel = '九八七六五四三二一' // Matches 9 - x numbering
  const lines: string[] = []

  // Header (matches the 9 - x numbering)
  lines.push('     9   8   7   6   5   4   3   2   1')
  lines.push('   ┌' + '───'.repeat(8) + '───┐')

  for (let row = 0; row < 10; row++) {
    let line = `${row}  │`
    for (let col = 0; col < 9; col++) {
      const ch = grid[row][col]
      line += ch === ' ' ? ' · ' : ` ${ch} `
    }
    line += `│`
    lines.push(line)

    // River between rows 4 and 5
    if (row === 4) {
      lines.push('   ├' + '───'.repeat(8) + '───┤  ── 楚河 汉界 ──')
    }
  }
  lines.push('   └' + '───'.repeat(8) + '───┘')

  // Piece inventory
  const redPieces: string[] = []
  const blackPieces: string[] = []
  for (const p of parsed.list) {
    const fileLabel = filesLabel[p.x]
    const entry = `${p.name} → 第${fileLabel}列第${p.y}行`
    if (p.side === 'RED') redPieces.push(entry)
    else blackPieces.push(entry)
  }
  lines.push('')
  lines.push('红方棋子: ' + redPieces.join(', '))
  lines.push('黑方棋子: ' + blackPieces.join(', '))

  return lines.join('\n')
}
