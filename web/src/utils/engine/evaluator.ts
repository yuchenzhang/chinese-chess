import { Board } from './board'

export class Evaluator {
  static PIECE_VALUES: Record<string, number> = {
    'K': 100000,
    'R': 900,
    'N': 400,
    'B': 200,
    'A': 200,
    'C': 450,
    'P': 100,
  }

  static PAWN_POSITION = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [10, 10, 20, 30, 30, 30, 20, 10, 10],
    [20, 20, 30, 40, 50, 40, 30, 20, 20],
    [30, 30, 40, 50, 60, 50, 40, 30, 30],
    [40, 40, 50, 60, 70, 60, 50, 40, 40],
    [50, 50, 60, 70, 80, 70, 60, 50, 50],
  ]

  static ROOK_POSITION = [
    [10, 10, 10, 15, 15, 15, 10, 10, 10],
    [10, 15, 15, 20, 20, 20, 15, 15, 10],
    [10, 15, 15, 20, 20, 20, 15, 15, 10],
    [15, 20, 20, 25, 25, 25, 20, 20, 15],
    [15, 20, 20, 25, 25, 25, 20, 20, 15],
    [15, 20, 20, 25, 25, 25, 20, 20, 15],
    [10, 15, 15, 20, 20, 20, 15, 15, 10],
    [10, 15, 15, 20, 20, 20, 15, 15, 10],
    [10, 10, 10, 15, 15, 15, 10, 10, 10],
    [10, 10, 10, 15, 15, 15, 10, 10, 10],
  ]

  static KNIGHT_POSITION = [
    [0, 0, 5, 10, 10, 10, 5, 0, 0],
    [0, 5, 10, 15, 15, 15, 10, 5, 0],
    [5, 10, 15, 20, 20, 20, 15, 10, 5],
    [10, 15, 20, 25, 25, 25, 20, 15, 10],
    [10, 15, 20, 25, 25, 25, 20, 15, 10],
    [10, 15, 20, 25, 25, 25, 20, 15, 10],
    [5, 10, 15, 20, 20, 20, 15, 10, 5],
    [0, 5, 10, 15, 15, 15, 10, 5, 0],
    [0, 0, 5, 10, 10, 10, 5, 0, 0],
    [0, 0, 0, 5, 5, 5, 0, 0, 0],
  ]

  static CANNON_POSITION = [
    [0, 0, 5, 10, 10, 10, 5, 0, 0],
    [0, 5, 10, 15, 15, 15, 10, 5, 0],
    [5, 10, 15, 20, 20, 20, 15, 10, 5],
    [10, 15, 20, 25, 25, 25, 20, 15, 10],
    [10, 15, 20, 25, 25, 25, 20, 15, 10],
    [10, 15, 20, 25, 25, 25, 20, 15, 10],
    [5, 10, 15, 20, 20, 20, 15, 10, 5],
    [0, 5, 10, 15, 15, 15, 10, 5, 0],
    [0, 0, 5, 10, 10, 10, 5, 0, 0],
    [0, 0, 0, 5, 5, 5, 0, 0, 0],
  ]

  evaluate(board: Board): number {
    let score = 0
    
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 9; col++) {
        const piece = board.squares[row][col]
        if (piece === null) continue
        
        const pieceType = piece.toUpperCase()
        const isRed = board.isRedPiece(piece)
        
        const baseValue = Evaluator.PIECE_VALUES[pieceType] || 0
        const posValue = this._getPositionValue(pieceType, row, col, isRed)
        
        if (isRed) {
          score += baseValue + posValue
        } else {
          score -= baseValue + posValue
        }
      }
    }
    
    if (board.isInCheck('w')) {
      score -= 500
    }
    if (board.isInCheck('b')) {
      score += 500
    }
    
    return score
  }

  private _getPositionValue(pieceType: string, row: number, col: number, isRed: boolean): number {
    if (!isRed) {
      row = 9 - row
    }
    
    if (pieceType === 'P') return Evaluator.PAWN_POSITION[row][col]
    if (pieceType === 'R') return Evaluator.ROOK_POSITION[row][col]
    if (pieceType === 'N') return Evaluator.KNIGHT_POSITION[row][col]
    if (pieceType === 'C') return Evaluator.CANNON_POSITION[row][col]
    
    return 0
  }
}