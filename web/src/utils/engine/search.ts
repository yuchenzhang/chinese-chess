import { Board, Move } from './board'
import type { PieceType } from './board'
import { Evaluator } from './evaluator'

export class AlphaBetaSearch {
  maxDepth: number
  evaluator: Evaluator
  nodesSearched: number
  startTime: number
  timeLimit: number
  lastCompletedDepth: number
  history: string[] = []
  repetitionCandidates: Set<string> = new Set()

  constructor(depth: number = 6) {
    this.maxDepth = depth
    this.evaluator = new Evaluator()
    this.nodesSearched = 0
    this.startTime = 0
    this.timeLimit = 5.0 // seconds
    this.lastCompletedDepth = 0
  }

  search(board: Board, maxTime: number = 5.0, history: string[] = []): [Move | null, number] {
    this.nodesSearched = 0
    this.startTime = Date.now() / 1000
    this.timeLimit = maxTime
    this.lastCompletedDepth = 0
    this.history = history

    // Pre-calculate repetition candidates to maximize search performance
    const counts = new Map<string, number>()
    for (const h of history) {
      const pos = h.split(' ').slice(0, 2).join(' ')
      counts.set(pos, (counts.get(pos) || 0) + 1)
    }
    this.repetitionCandidates = new Set<string>()
    for (const [pos, count] of counts.entries()) {
      if (count >= 3) {
        this.repetitionCandidates.add(pos)
      }
    }

    const legalMoves = board.generateLegalMoves()
    if (legalMoves.length === 0) {
      if (board.isInCheck(board.sideToMove)) {
        return [null, board.sideToMove === 'w' ? -100000 : 100000]
      } else {
        return [null, 0]
      }
    }

    let finalBestMove = legalMoves[0]
    let finalBestScore = board.sideToMove === 'w' ? -Infinity : Infinity

    for (let currentDepth = 1; currentDepth <= this.maxDepth; currentDepth++) {
      const elapsed = (Date.now() / 1000) - this.startTime
      if (elapsed > this.timeLimit * 0.4 && currentDepth > 1) {
        break
      }

      const orderedMoves = this._orderMoves(board, legalMoves)

      let alpha = -Infinity
      let beta = Infinity

      let currentIterBestMove: Move | null = null
      let currentIterBestScore = board.sideToMove === 'w' ? -Infinity : Infinity

      let timedOut = false

      for (const move of orderedMoves) {
        const newBoard = board.makeMove(move)

        // Repetition check in root loop (completely avoid if repeated 3 times already AND AI is the attacking side)
        if (this.repetitionCandidates.size > 0) {
          const nextFen = newBoard.toFen().split(' ').slice(0, 2).join(' ')
          if (this.repetitionCandidates.has(nextFen)) {
            if (this._isAttackingMove(board, move, newBoard, board.sideToMove)) {
              const repetitionPenalty = board.sideToMove === 'w' ? -999999 : 999999
              if (board.sideToMove === 'w') {
                if (repetitionPenalty > currentIterBestScore) {
                  currentIterBestScore = repetitionPenalty
                  currentIterBestMove = move
                }
              } else {
                if (repetitionPenalty < currentIterBestScore) {
                  currentIterBestScore = repetitionPenalty
                  currentIterBestMove = move
                }
              }
              continue
            }
          }
        }

        const score = this._alphaBeta(newBoard, currentDepth - 1, alpha, beta)

        if ((Date.now() / 1000) - this.startTime > this.timeLimit) {
          timedOut = true
          break
        }

        if (board.sideToMove === 'w') {
          if (score > currentIterBestScore) {
            currentIterBestScore = score
            currentIterBestMove = move
          }
          alpha = Math.max(alpha, score)
        } else {
          if (score < currentIterBestScore) {
            currentIterBestScore = score
            currentIterBestMove = move
          }
          beta = Math.min(beta, score)
        }
      }

      if (!timedOut && currentIterBestMove) {
        finalBestMove = currentIterBestMove
        finalBestScore = currentIterBestScore
        this.lastCompletedDepth = currentDepth
      } else {
        break
      }
    }

    return [finalBestMove, finalBestScore]
  }

  private _alphaBeta(board: Board, depth: number, alpha: number, beta: number): number {
    this.nodesSearched++

    if ((Date.now() / 1000) - this.startTime > this.timeLimit) {
      return this.evaluator.evaluate(board)
    }

    if (depth <= 0) {
      return this._quiescenceSearch(board, alpha, beta)
    }

    const legalMoves = board.generateLegalMoves()

    if (legalMoves.length === 0) {
      if (board.isInCheck(board.sideToMove)) {
        return board.sideToMove === 'w' ? -100000 : 100000
      } else {
        return 0
      }
    }

    const orderedMoves = this._orderMoves(board, legalMoves)

    if (board.sideToMove === 'w') {
      let maxEval = -Infinity
      for (const move of orderedMoves) {
        const newBoard = board.makeMove(move)

        // Repetition check: if this move leads to a position that happened in the game >= 3 times AND AI is attacking, completely avoid it.
        if (this.repetitionCandidates.size > 0) {
          const nextFen = newBoard.toFen().split(' ').slice(0, 2).join(' ')
          if (this.repetitionCandidates.has(nextFen)) {
            if (this._isAttackingMove(board, move, newBoard, board.sideToMove)) {
              // Penalize repetition extremely heavily (completely avoid)
              const repetitionPenalty = -999999 
              maxEval = Math.max(maxEval, repetitionPenalty)
              continue
            }
          }
        }

        const evalScore = this._alphaBeta(newBoard, depth - 1, alpha, beta)
        maxEval = Math.max(maxEval, evalScore)
        alpha = Math.max(alpha, evalScore)
        if (beta <= alpha) break
      }
      return maxEval
    } else {
      let minEval = Infinity
      for (const move of orderedMoves) {
        const newBoard = board.makeMove(move)

        // Repetition check: if this move leads to a position that happened in the game >= 3 times AND AI is attacking, completely avoid it.
        if (this.repetitionCandidates.size > 0) {
          const nextFen = newBoard.toFen().split(' ').slice(0, 2).join(' ')
          if (this.repetitionCandidates.has(nextFen)) {
            if (this._isAttackingMove(board, move, newBoard, board.sideToMove)) {
              const repetitionPenalty = 999999
              minEval = Math.min(minEval, repetitionPenalty)
              continue
            }
          }
        }

        const evalScore = this._alphaBeta(newBoard, depth - 1, alpha, beta)
        minEval = Math.min(minEval, evalScore)
        beta = Math.min(beta, evalScore)
        if (beta <= alpha) break
      }
      return minEval
    }
  }

  private _quiescenceSearch(board: Board, alpha: number, beta: number, depth: number = 0): number {
    if (depth > 4) {
      return this.evaluator.evaluate(board)
    }

    const standPat = this.evaluator.evaluate(board)

    if (board.sideToMove === 'w') {
      if (standPat >= beta) return beta
      alpha = Math.max(alpha, standPat)
    } else {
      if (standPat <= alpha) return alpha
      beta = Math.min(beta, standPat)
    }

    const captureMoves = this._getCaptureMoves(board)
    const orderedCaptures = this._orderCaptures(board, captureMoves)

    if (board.sideToMove === 'w') {
      for (const move of orderedCaptures) {
        const newBoard = board.makeMove(move)
        const score = this._quiescenceSearch(newBoard, alpha, beta, depth + 1)
        if (score >= beta) return beta
        alpha = Math.max(alpha, score)
      }
      return alpha
    } else {
      for (const move of orderedCaptures) {
        const newBoard = board.makeMove(move)
        const score = this._quiescenceSearch(newBoard, alpha, beta, depth + 1)
        if (score <= alpha) return alpha
        beta = Math.min(beta, score)
      }
      return beta
    }
  }

  private _orderMoves(board: Board, moves: Move[]): Move[] {
    const scores = new Map<Move, number>()
    
    for (const move of moves) {
      let score = 0
      const target = board.getPiece(move.to_row, move.to_col)
      if (target !== null) {
        const attackerValue = this._getPieceValue(board.getPiece(move.from_row, move.from_col))
        const victimValue = this._getPieceValue(target)
        score += victimValue * 10 - attackerValue
      }
      
      const newBoard = board.makeMove(move)
      const opponent = board.sideToMove === 'w' ? 'b' : 'w'
      if (newBoard.isInCheck(opponent)) {
        score += 500
      }
      
      scores.set(move, score)
    }

    return moves.sort((a, b) => (scores.get(b) || 0) - (scores.get(a) || 0))
  }

  private _getCaptureMoves(board: Board): Move[] {
    const legalMoves = board.generateLegalMoves()
    return legalMoves.filter(m => board.getPiece(m.to_row, m.to_col) !== null)
  }

  private _orderCaptures(board: Board, moves: Move[]): Move[] {
    const scores = new Map<Move, number>()
    for (const move of moves) {
      const victim = board.getPiece(move.to_row, move.to_col)
      const attacker = board.getPiece(move.from_row, move.from_col)
      const victimValue = this._getPieceValue(victim)
      const attackerValue = this._getPieceValue(attacker)
      scores.set(move, victimValue * 10 - attackerValue)
    }
    return moves.sort((a, b) => (scores.get(b) || 0) - (scores.get(a) || 0))
  }

  private _getPieceValue(piece: PieceType): number {
    if (piece === null) return 0
    return Evaluator.PIECE_VALUES[piece.toUpperCase()] || 0
  }

  private _isThreateningMajorPiece(board: Board, side: 'w' | 'b'): boolean {
    const tempBoard = new Board()
    tempBoard.squares = board.squares.map(row => [...row])
    tempBoard.sideToMove = side

    const legalMoves = tempBoard.generateLegalMoves()
    for (const move of legalMoves) {
      const targetPiece = tempBoard.getPiece(move.to_row, move.to_col)
      if (targetPiece !== null) {
        const type = targetPiece.toUpperCase()
        // R: Chariot (车), H: Horse (马), C: Cannon (炮)
        if (type === 'R' || type === 'H' || type === 'C') {
          return true
        }
      }
    }
    return false
  }

  private _isAttackingMove(board: Board, move: Move, newBoard: Board, side: 'w' | 'b'): boolean {
    const opponent = side === 'w' ? 'b' : 'w'
    
    // 1. General check (将军)
    if (newBoard.isInCheck(opponent)) {
      return true
    }
    
    // 2. Threaten opponent's major pieces (捉子 - 车/马/炮)
    if (this._isThreateningMajorPiece(newBoard, side)) {
      return true
    }
    
    return false
  }
}