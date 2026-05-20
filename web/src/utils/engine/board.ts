export class Move {
  constructor(
    public from_row: number,
    public from_col: number,
    public to_row: number,
    public to_col: number
  ) {}

  toUci(): string {
    const cols = 'abcdefghi'
    return `${cols[this.from_col]}${9 - this.from_row}${cols[this.to_col]}${9 - this.to_row}`
  }

  static fromUci(uci: string): Move {
    const cols = 'abcdefghi'
    const from_col = cols.indexOf(uci[0])
    const from_row = 9 - parseInt(uci[1], 10)
    const to_col = cols.indexOf(uci[2])
    const to_row = 9 - parseInt(uci[3], 10)
    return new Move(from_row, from_col, to_row, to_col)
  }
}

export type PieceType = string | null

export class Board {
  static PIECE_TO_FEN: Record<string, string> = {
    'R': 'R', 'N': 'N', 'B': 'B', 'A': 'A', 'K': 'K', 'C': 'C', 'P': 'P',
    'r': 'r', 'n': 'n', 'b': 'b', 'a': 'a', 'k': 'k', 'c': 'c', 'p': 'p'
  }

  static FEN_TO_PIECE: Record<string, string> = Object.entries(Board.PIECE_TO_FEN).reduce((acc, [k, v]) => {
    acc[v] = k
    return acc
  }, {} as Record<string, string>)

  squares: PieceType[][]
  sideToMove: 'w' | 'b'

  constructor() {
    this.squares = Array(10).fill(null).map(() => Array(9).fill(null))
    this.sideToMove = 'w'
  }

  static fromFen(fen: string): Board {
    const board = new Board()
    const parts = fen.split(' ')
    const rows = parts[0].split('/')

    rows.forEach((row, rowIdx) => {
      let colIdx = 0
      for (let i = 0; i < row.length; i++) {
        const char = row[i]
        if (!isNaN(parseInt(char, 10))) {
          colIdx += parseInt(char, 10)
        } else {
          board.squares[rowIdx][colIdx] = Board.FEN_TO_PIECE[char] || null
          colIdx++
        }
      }
    })

    if (parts.length > 1) {
      board.sideToMove = parts[1] as 'w' | 'b'
    }

    return board
  }

  toFen(): string {
    const rows = this.squares.map(row => {
      let fenRow = ''
      let emptyCount = 0
      row.forEach(piece => {
        if (piece === null) {
          emptyCount++
        } else {
          if (emptyCount > 0) {
            fenRow += emptyCount
            emptyCount = 0
          }
          fenRow += Board.PIECE_TO_FEN[piece] || piece
        }
      })
      if (emptyCount > 0) {
        fenRow += emptyCount
      }
      return fenRow
    })

    return [rows.join('/'), this.sideToMove, '-', '-', '0', '1'].join(' ')
  }

  getPiece(row: number, col: number): PieceType {
    if (row >= 0 && row < 10 && col >= 0 && col < 9) {
      return this.squares[row][col]
    }
    return null
  }

  makeMove(move: Move): Board {
    const newBoard = new Board()
    newBoard.squares = this.squares.map(row => [...row])
    newBoard.sideToMove = this.sideToMove === 'w' ? 'b' : 'w'

    const piece = newBoard.squares[move.from_row][move.from_col]
    newBoard.squares[move.to_row][move.to_col] = piece
    newBoard.squares[move.from_row][move.from_col] = null

    return newBoard
  }

  isRedPiece(piece: string): boolean {
    return piece === piece.toUpperCase()
  }

  isBlackPiece(piece: string): boolean {
    return piece === piece.toLowerCase()
  }

  getKingPosition(side: 'w' | 'b'): [number, number] | null {
    const king = side === 'w' ? 'K' : 'k'
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 9; col++) {
        if (this.squares[row][col] === king) {
          return [row, col]
        }
      }
    }
    return null
  }

  isAttacked(row: number, col: number, attackerSide: 'w' | 'b'): boolean {
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    for (const [dr, dc] of directions) {
      let obstacleCount = 0
      for (let dist = 1; dist < 10; dist++) {
        const r = row + dr * dist
        const c = col + dc * dist
        if (r < 0 || r >= 10 || c < 0 || c >= 9) break

        const target = this.squares[r][c]
        if (target !== null) {
          const targetSide = this.isRedPiece(target) ? 'w' : 'b'
          const pieceType = target.toUpperCase()

          if (obstacleCount === 0) {
            if (targetSide === attackerSide) {
              if (pieceType === 'R' || pieceType === 'K') return true
            }
            obstacleCount = 1
          } else if (obstacleCount === 1) {
            if (targetSide === attackerSide && pieceType === 'C') return true
            obstacleCount = 2
          } else {
            break
          }
        }
      }
    }

    const knightTargets = [
      [row - 2, col - 1, row - 1, col], [row - 2, col + 1, row - 1, col],
      [row + 2, col - 1, row + 1, col], [row + 2, col + 1, row + 1, col],
      [row - 1, col - 2, row, col - 1], [row + 1, col - 2, row, col - 1],
      [row - 1, col + 2, row, col + 1], [row + 1, col + 2, row, col + 1]
    ]
    for (const [r, c, br, bc] of knightTargets) {
      if (r >= 0 && r < 10 && c >= 0 && c < 9) {
        const target = this.squares[r][c]
        if (target !== null) {
          const targetSide = this.isRedPiece(target) ? 'w' : 'b'
          if (targetSide === attackerSide && target.toUpperCase() === 'N') {
            if (this.squares[br][bc] === null) return true
          }
        }
      }
    }

    const pawnCandidates: [number, number][] = []
    if (attackerSide === 'w') {
      pawnCandidates.push([row + 1, col])
      if (row <= 4) {
        pawnCandidates.push([row, col - 1])
        pawnCandidates.push([row, col + 1])
      }
    } else {
      pawnCandidates.push([row - 1, col])
      if (row >= 5) {
        pawnCandidates.push([row, col - 1])
        pawnCandidates.push([row, col + 1])
      }
    }

    for (const [r, c] of pawnCandidates) {
      if (r >= 0 && r < 10 && c >= 0 && c < 9) {
        const target = this.squares[r][c]
        if (target !== null) {
          const targetSide = this.isRedPiece(target) ? 'w' : 'b'
          if (targetSide === attackerSide && target.toUpperCase() === 'P') {
            return true
          }
        }
      }
    }

    return false
  }

  isInCheck(side: 'w' | 'b'): boolean {
    const kingPos = this.getKingPosition(side)
    if (!kingPos) return false
    const opponent = side === 'w' ? 'b' : 'w'
    return this.isAttacked(kingPos[0], kingPos[1], opponent)
  }

  generateLegalMoves(): Move[] {
    const pseudoMoves = this._generatePseudoLegalMoves(this.sideToMove)
    return pseudoMoves.filter(move => {
      const newBoard = this.makeMove(move)
      return !newBoard.isInCheck(this.sideToMove)
    })
  }

  private _generatePseudoLegalMoves(side: 'w' | 'b'): Move[] {
    const moves: Move[] = []
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 9; col++) {
        const piece = this.squares[row][col]
        if (piece === null) continue
        
        const pieceSide = this.isRedPiece(piece) ? 'w' : 'b'
        if (pieceSide !== side) continue

        const pieceType = piece.toUpperCase()
        moves.push(...this._getPieceMoves(row, col, pieceType, side))
      }
    }
    return moves
  }

  private _getPieceMoves(row: number, col: number, pieceType: string, side: 'w' | 'b'): Move[] {
    switch (pieceType) {
      case 'R': return this._getRookMoves(row, col, side)
      case 'N': return this._getKnightMoves(row, col, side)
      case 'B': return this._getBishopMoves(row, col, side)
      case 'A': return this._getAdvisorMoves(row, col, side)
      case 'K': return this._getKingMoves(row, col, side)
      case 'C': return this._getCannonMoves(row, col, side)
      case 'P': return this._getPawnMoves(row, col, side)
    }
    return []
  }

  private _getRookMoves(row: number, col: number, side: 'w' | 'b'): Move[] {
    const moves: Move[] = []
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    
    for (const [dr, dc] of directions) {
      for (let dist = 1; dist < 10; dist++) {
        const newRow = row + dr * dist
        const newCol = col + dc * dist
        if (newRow < 0 || newRow >= 10 || newCol < 0 || newCol >= 9) break
        
        const target = this.squares[newRow][newCol]
        if (target === null) {
          moves.push(new Move(row, col, newRow, newCol))
        } else {
          const targetSide = this.isRedPiece(target) ? 'w' : 'b'
          if (targetSide !== side) {
            moves.push(new Move(row, col, newRow, newCol))
          }
          break
        }
      }
    }
    return moves
  }

  private _getKnightMoves(row: number, col: number, side: 'w' | 'b'): Move[] {
    const moves: Move[] = []
    const offsets = [
      [-2, -1, -1, 0], [-2, 1, -1, 0],
      [2, -1, 1, 0], [2, 1, 1, 0],
      [-1, -2, 0, -1], [1, -2, 0, -1],
      [-1, 2, 0, 1], [1, 2, 0, 1]
    ]

    for (const [dr, dc, br, bc] of offsets) {
      const newRow = row + dr
      const newCol = col + dc
      const bRow = row + br
      const bCol = col + bc

      if (newRow < 0 || newRow >= 10 || newCol < 0 || newCol >= 9) continue
      if (this.squares[bRow][bCol] !== null) continue

      const target = this.squares[newRow][newCol]
      if (target === null) {
        moves.push(new Move(row, col, newRow, newCol))
      } else {
        const targetSide = this.isRedPiece(target) ? 'w' : 'b'
        if (targetSide !== side) {
          moves.push(new Move(row, col, newRow, newCol))
        }
      }
    }
    return moves
  }

  private _getBishopMoves(row: number, col: number, side: 'w' | 'b'): Move[] {
    const moves: Move[] = []
    if (side === 'w' && row < 5) return moves
    if (side === 'b' && row > 4) return moves

    const directions = [[-2, -2], [-2, 2], [2, -2], [2, 2]]
    for (const [dr, dc] of directions) {
      const newRow = row + dr
      const newCol = col + dc

      if (side === 'w') {
        if (newRow < 5 || newRow > 9 || newCol < 0 || newCol > 8) continue
      } else {
        if (newRow < 0 || newRow > 4 || newCol < 0 || newCol > 8) continue
      }

      const eyeRow = row + Math.floor(dr / 2)
      const eyeCol = col + Math.floor(dc / 2)
      if (this.squares[eyeRow][eyeCol] !== null) continue

      const target = this.squares[newRow][newCol]
      if (target === null) {
        moves.push(new Move(row, col, newRow, newCol))
      } else {
        const targetSide = this.isRedPiece(target) ? 'w' : 'b'
        if (targetSide !== side) {
          moves.push(new Move(row, col, newRow, newCol))
        }
      }
    }
    return moves
  }

  private _getAdvisorMoves(row: number, col: number, side: 'w' | 'b'): Move[] {
    const moves: Move[] = []
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]]

    for (const [dr, dc] of directions) {
      const newRow = row + dr
      const newCol = col + dc

      if (side === 'w') {
        if (newRow < 7 || newRow > 9 || newCol < 3 || newCol > 5) continue
      } else {
        if (newRow < 0 || newRow > 2 || newCol < 3 || newCol > 5) continue
      }

      const target = this.squares[newRow][newCol]
      if (target === null) {
        moves.push(new Move(row, col, newRow, newCol))
      } else {
        const targetSide = this.isRedPiece(target) ? 'w' : 'b'
        if (targetSide !== side) {
          moves.push(new Move(row, col, newRow, newCol))
        }
      }
    }
    return moves
  }

  private _getKingMoves(row: number, col: number, side: 'w' | 'b'): Move[] {
    const moves: Move[] = []
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]

    for (const [dr, dc] of directions) {
      const newRow = row + dr
      const newCol = col + dc

      if (side === 'w') {
        if (newRow < 7 || newRow > 9 || newCol < 3 || newCol > 5) continue
      } else {
        if (newRow < 0 || newRow > 2 || newCol < 3 || newCol > 5) continue
      }

      const target = this.squares[newRow][newCol]
      if (target === null) {
        moves.push(new Move(row, col, newRow, newCol))
      } else {
        const targetSide = this.isRedPiece(target) ? 'w' : 'b'
        if (targetSide !== side) {
          moves.push(new Move(row, col, newRow, newCol))
        }
      }
    }
    return moves
  }

  private _getCannonMoves(row: number, col: number, side: 'w' | 'b'): Move[] {
    const moves: Move[] = []
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]

    for (const [dr, dc] of directions) {
      for (let dist = 1; dist < 10; dist++) {
        const newRow = row + dr * dist
        const newCol = col + dc * dist
        if (newRow < 0 || newRow >= 10 || newCol < 0 || newCol >= 9) break

        const target = this.squares[newRow][newCol]
        if (target === null) {
          moves.push(new Move(row, col, newRow, newCol))
        } else {
          for (let dist2 = dist + 1; dist2 < 10; dist2++) {
            const newRow2 = row + dr * dist2
            const newCol2 = col + dc * dist2
            if (newRow2 < 0 || newRow2 >= 10 || newCol2 < 0 || newCol2 >= 9) break

            const target2 = this.squares[newRow2][newCol2]
            if (target2 !== null) {
              const targetSide = this.isRedPiece(target2) ? 'w' : 'b'
              if (targetSide !== side) {
                moves.push(new Move(row, col, newRow2, newCol2))
              }
              break
            }
          }
          break
        }
      }
    }
    return moves
  }

  private _getPawnMoves(row: number, col: number, side: 'w' | 'b'): Move[] {
    const moves: Move[] = []
    
    if (side === 'w') {
      if (row > 0) {
        const newRow = row - 1
        const target = this.squares[newRow][col]
        if (target === null || (!this.isRedPiece(target))) {
          moves.push(new Move(row, col, newRow, col))
        }
      }
      if (row <= 4) {
        for (const dc of [-1, 1]) {
          const newCol = col + dc
          if (newCol >= 0 && newCol < 9) {
            const target = this.squares[row][newCol]
            if (target === null || (!this.isRedPiece(target))) {
              moves.push(new Move(row, col, row, newCol))
            }
          }
        }
      }
    } else {
      if (row < 9) {
        const newRow = row + 1
        const target = this.squares[newRow][col]
        if (target === null || this.isRedPiece(target)) {
          moves.push(new Move(row, col, newRow, col))
        }
      }
      if (row >= 5) {
        for (const dc of [-1, 1]) {
          const newCol = col + dc
          if (newCol >= 0 && newCol < 9) {
            const target = this.squares[row][newCol]
            if (target === null || this.isRedPiece(target)) {
              moves.push(new Move(row, col, row, newCol))
            }
          }
        }
      }
    }
    return moves
  }
}