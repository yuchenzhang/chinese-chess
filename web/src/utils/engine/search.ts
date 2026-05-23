import { Board, Move } from './board'
import type { PieceType } from './board'
import { Evaluator } from './evaluator'

/**
 * 象棋 AI 引擎的核心搜索类：AlphaBetaSearch
 * 
 * 本类基于博弈论的极大极小值算法 (Minimax) 进行了多项经典优化，构建了高性能的中国象棋搜索算法：
 * 
 * 1. 【极大极小搜索 (Minimax) 与 Alpha-Beta 剪枝】：
 *    - 红方 (w) 作为极大玩家 (Maximizing Player)，追求评估分最大化；
 *    - 黑方 (b) 作为极小玩家 (Minimizing Player)，追求评估分最小化；
 *    - 通过 Alpha (下界) 和 Beta (上界) 剪枝，过滤掉对手绝对不可能让你走到的劣势分支，大幅减少搜索节点数。
 * 
 * 2. 【迭代加深搜索 (Iterative Deepening)】：
 *    - 并不是直接一次性搜索到最大深度 (maxDepth)，而是从深度 1 开始，逐层增加深度进行搜索；
 *    - 这样不仅可以方便地在时间耗尽时立即返回上一层已完成的最佳结果，还能在更深层次搜索时利用前一层得到的最佳走法，
 *      从而极大地提升 Move Ordering (移动排序) 的效率。
 * 
 * 3. 【静态搜索 (Quiescence Search)】：
 *    - 在基础深度耗尽后，如果盘面依然处于激烈的吃子和对攻中，普通估值会产生严重的“水平线效应” (Horizon Effect)；
 *    - 静态搜索会在普通深度耗尽后，继续只搜索“吃子走法” (Capture Moves)，直到盘面达到一个相对静态稳定的状态再进行评估。
 * 
 * 4. 【走法排序与优化 (Move Ordering / MVV-LVA)】：
 *    - 吃子走法基于 MVV-LVA (Most Valuable Victim - Least Valuable Attacker) 进行排序；
 *    - 即：用价值最低的棋子去吃对方价值最高的棋子拥有最高的优先级。这能让 Alpha-Beta 剪枝更快触发。
 * 
 * 5. 【中国象棋特有规则——重复局面与长将/长捉惩罚】：
 *    - 根据中国象棋竞赛规则，长将、长捉等长攻走法属于违规，判负；而普通的闲循环属于和棋；
 *    - 本算法通过分析棋盘历史，检测是否出现 3 次及以上的重复局面。如果 AI 处于主动攻击状态 (将或捉) 且引发重复局面，
 *      会施加极大的评估分惩罚 (-999999 / 999999)，彻底避免 AI 走出作茧自缚的长将或长捉。
 */
export class AlphaBetaSearch {
  /** 允许搜索的最大深度（层数），层数越多 AI 越聪明，但开销呈指数增长 */
  maxDepth: number
  /** 局势评估器，用于对棋盘上的静态局面给出数字分值（红正黑负） */
  evaluator: Evaluator
  /** 性能计数器：本次搜索一共遍历了多少个棋盘节点 */
  nodesSearched: number
  /** 本次搜索的开始时间戳（秒级） */
  startTime: number
  /** 单步搜索时间上限（单位：秒） */
  timeLimit: number
  /** 最近一次成功且完整搜索完的深度 */
  lastCompletedDepth: number
  /** 当前对局的历史记录走法 FEN，用于重复局面检测 */
  history: string[] = []
  /** 重复局面候选集：已经在历史中出现过 2 次以上的局面（保存 FEN 的棋子和行棋方部分） */
  repetitionCandidates: Set<string> = new Set()

  constructor(depth: number = 6) {
    this.maxDepth = depth
    this.evaluator = new Evaluator()
    this.nodesSearched = 0
    this.startTime = 0
    this.timeLimit = 5.0 // 默认单步限时 5 秒
    this.lastCompletedDepth = 0
  }

  /**
   * 启动 AI 思考，计算当前局面的最佳走法
   * 
   * @param board 当前的棋盘状态 (Board 实例)
   * @param maxTime 限制思考的最长时间（秒）
   * @param history 对局历史记录走法，用于在搜索中避免重复局面
   * @returns 返回一个元组：[最佳走法 (Move) 或 null 如果无棋可走, 最佳得分值]
   */
  search(board: Board, maxTime: number = 5.0, history: string[] = []): [Move | null, number] {
    this.nodesSearched = 0
    this.startTime = Date.now() / 1000
    this.timeLimit = maxTime
    this.lastCompletedDepth = 0
    this.history = history

    // --- 1. 预处理对局历史以检测重复局面 ---
    // 为了防止在深度搜索的树枝中反复进行昂贵的 FEN 过滤，我们预先扫描历史。
    // FEN 串的前两部分是“棋子排布”与“当前行棋方”（如 'rnbakabnr/9/... w'），代表独立局面状态。
    const counts = new Map<string, number>()
    for (const h of history) {
      const pos = h.split(' ').slice(0, 2).join(' ')
      counts.set(pos, (counts.get(pos) || 0) + 1)
    }
    
    // 如果某个局面在历史中已经出现过至少 2 次（count >= 2，在搜索树中再走一步就会触发第 3 次），
    // 那么它就是我们需要在搜索树中极力识别并施加规则判罚的重复局面候选。
    this.repetitionCandidates = new Set<string>()
    for (const [pos, count] of counts.entries()) {
      if (count >= 2) {
        this.repetitionCandidates.add(pos)
      }
    }

    // --- 2. 生成并验证合法走法 ---
    const legalMoves = board.generateLegalMoves()
    if (legalMoves.length === 0) {
      // 如果无合法走法，且当前被将军，则是被“困毙”或“将死”
      if (board.isInCheck(board.sideToMove)) {
        // 白方（红子）被将死，返回负无穷大的惩罚；黑方被将死，返回正无穷大
        return [null, board.sideToMove === 'w' ? -100000 : 100000]
      } else {
        // 无合法走法但未被将军，为无子可动（也是输，但分值略有不同，这里设为 0 作为兜底）
        return [null, 0]
      }
    }

    // 默认最佳走法和分值（做最坏的打算）
    let finalBestMove = legalMoves[0]
    let finalBestScore = board.sideToMove === 'w' ? -Infinity : Infinity

    // --- 3. 核心：迭代加深搜索 (Iterative Deepening) ---
    // 从深度 1 开始逐层搜索，直到最大深度限制。
    for (let currentDepth = 1; currentDepth <= this.maxDepth; currentDepth++) {
      const elapsed = (Date.now() / 1000) - this.startTime
      // 如果上一层搜索已经消耗了超过 40% 的限时，则不启动更深的一层搜索，防止超时
      if (elapsed > this.timeLimit * 0.4 && currentDepth > 1) {
        break
      }

      // 对本层决策前的根节点合法走法进行启发式排序，把最可能有优势的走法排在前面
      const orderedMoves = this._orderMoves(board, legalMoves)

      let alpha = -Infinity
      let beta = Infinity

      let currentIterBestMove: Move | null = null
      let currentIterBestScore = board.sideToMove === 'w' ? -Infinity : Infinity
      let timedOut = false

      // 遍历所有可能的走法
      for (const move of orderedMoves) {
        // 尝试模拟走子
        const newBoard = board.makeMove(move)

        // --- 重复局面检测（根循环） ---
        // 检查这一步走法是否会导致历史局面的第 3 次重现
        if (this.repetitionCandidates.size > 0) {
          const nextFen = newBoard.toFen().split(' ').slice(0, 2).join(' ')
          if (this.repetitionCandidates.has(nextFen)) {
            // 如果会产生重复局面，并且这一步是 AI 的主动攻击 (长将或长捉)
            if (this._isAttackingMove(newBoard, board.sideToMove)) {
              // 按照象棋规程：主动长将/长捉属于犯规，必须变着，否则判负。
              // 这里对犯规的玩家施加致命的巨额扣分惩罚 (-999999 或 999999)
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
              continue // 直接跳过这个犯规分支的进一步深搜
            }
          }
        }

        // 调用 Alpha-Beta 递归深搜计算该子分支的评估分值
        const score = this._alphaBeta(newBoard, currentDepth - 1, alpha, beta)

        // 如果在深搜过程中发现时间已经耗尽，则立即舍弃这一层的所有未完成的评估结果，避免超时
        if ((Date.now() / 1000) - this.startTime > this.timeLimit) {
          timedOut = true
          break
        }

        // 更新极大/极小窗口分值，以及本层迭代的最佳得分与走法
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

      // 如果这一层完整地搜索完了，且没有超时，我们就把这层计算出的最佳走法作为最新的最可靠决策
      if (!timedOut && currentIterBestMove) {
        finalBestMove = currentIterBestMove
        finalBestScore = currentIterBestScore
        this.lastCompletedDepth = currentDepth
      } else {
        // 超时了就直接中断后续更深层的迭代加深
        break
      }
    }

    return [finalBestMove, finalBestScore]
  }

  /**
   * 递归的 Alpha-Beta 搜索函数
   * 
   * @param board 模拟当前的虚拟盘面
   * @param depth 剩余的搜索深度层数
   * @param alpha 当前最佳最大值（红方的最好收益保障）
   * @param beta 当前最佳最小值（黑方的最好收益保障）
   * @returns 该虚拟局面的评估分数
   */
  private _alphaBeta(board: Board, depth: number, alpha: number, beta: number): number {
    this.nodesSearched++

    // 超时安全机制：如果搜索中已经超时，立即截断并返回静态评估分值
    if ((Date.now() / 1000) - this.startTime > this.timeLimit) {
      return this.evaluator.evaluate(board)
    }

    // 当基础搜索深度消耗完毕后，进入静态搜索 (Quiescence Search)，防止吃子对攻时的水平线效应
    if (depth <= 0) {
      return this._quiescenceSearch(board, alpha, beta)
    }

    const legalMoves = board.generateLegalMoves()

    // 叶子节点：无合法走法，判断是否被将军
    if (legalMoves.length === 0) {
      if (board.isInCheck(board.sideToMove)) {
        // 将死：极大玩家（白/红）输，返回极低分；极小玩家（黑）输，返回极高分
        return board.sideToMove === 'w' ? -100000 : 100000
      } else {
        // 困毙（也是输，返回 0 分作为兜底）
        return 0
      }
    }

    // 启用启发式排序以最快触发 Beta 剪枝或 Alpha 剪枝
    const orderedMoves = this._orderMoves(board, legalMoves)

    if (board.sideToMove === 'w') {
      // 极大玩家（白方/红子）：目标是追求更高的分数
      let maxEval = -Infinity
      for (const move of orderedMoves) {
        const newBoard = board.makeMove(move)

        // 递归树中的重复局面检测
        if (this.repetitionCandidates.size > 0) {
          const nextFen = newBoard.toFen().split(' ').slice(0, 2).join(' ')
          if (this.repetitionCandidates.has(nextFen)) {
            if (this._isAttackingMove(newBoard, board.sideToMove)) {
              // 犯规惩罚：长将/长捉长攻方施加致命扣分
              const repetitionPenalty = -999999 
              maxEval = Math.max(maxEval, repetitionPenalty)
              continue
            }
          }
        }

        const evalScore = this._alphaBeta(newBoard, depth - 1, alpha, beta)
        maxEval = Math.max(maxEval, evalScore)
        alpha = Math.max(alpha, evalScore)
        // 剪枝关键：如果这个走法红方的底线收益 alpha 已经超越了黑方可以接受的 beta，
        // 则黑方绝对不可能选择能走到当前节点的走法。直接剪枝，不再搜索当前节点下的剩余走法！
        if (beta <= alpha) break
      }
      return maxEval
    } else {
      // 极小玩家（黑方/黑子）：目标是追求更低的分数
      let minEval = Infinity
      for (const move of orderedMoves) {
        const newBoard = board.makeMove(move)

        // 递归树中的重复局面检测
        if (this.repetitionCandidates.size > 0) {
          const nextFen = newBoard.toFen().split(' ').slice(0, 2).join(' ')
          if (this.repetitionCandidates.has(nextFen)) {
            if (this._isAttackingMove(newBoard, board.sideToMove)) {
              // 犯规惩罚：黑方犯规则使其评估分数暴涨，让 AI 绝对不敢选择这一步
              const repetitionPenalty = 999999
              minEval = Math.min(minEval, repetitionPenalty)
              continue
            }
          }
        }

        const evalScore = this._alphaBeta(newBoard, depth - 1, alpha, beta)
        minEval = Math.min(minEval, evalScore)
        beta = Math.min(beta, evalScore)
        // 剪枝关键：如果最小下限收益 beta 已经低于了红方的最高底线收益 alpha，
        // 红方绝对会走其他路，当前节点对双方都没价值，立即剪枝！
        if (beta <= alpha) break
      }
      return minEval
    }
  }

  /**
   * 静态搜索 (Quiescence Search)：解决博弈树搜索中的“水平线效应”
   * 
   * 如果仅用普通 Alpha-Beta 搜索到某一固定深度就立即结束评估，
   * 那么在第 6 层如果 AI 刚好用“车”吃掉了玩家的“马”，AI 可能会觉得白赚了一个马；
   * 但其实在第 7 层（水平线之外），玩家可以立刻用“炮”回吃 AI 的“车”。这会导致严重的致命误判。
   * 
   * 静态搜索通过【只搜索吃子动作 (Captures Only)】的方法，沿着对攻战术分支继续深搜，
   * 从而得到一个没有即时对吃子的“平静局面”后再去调用 evaluator.evaluate 估值，确保评估极其可靠。
   * 
   * @param board 模拟当前的虚拟盘面
   * @param alpha 红方当前保障得分
   * @param beta 黑方当前保障得分
   * @param depth 静态搜索递归当前的层数，限制静态深度防止无限爆发
   * @returns 静态评估分值
   */
  private _quiescenceSearch(board: Board, alpha: number, beta: number, depth: number = 0): number {
    if ((Date.now() / 1000) - this.startTime > this.timeLimit) {
      return this.evaluator.evaluate(board)
    }

    // 限制静态搜索的最大深度（如限制在 4 层以内），防止在超级复杂的吃子大混战中耗尽算力
    if (depth > 4) {
      return this.evaluator.evaluate(board)
    }

    // 估算不吃子、选择现状 (Stand Pat) 时的局势静态评估得分
    const standPat = this.evaluator.evaluate(board)

    // 作为 Alpha-Beta 的扩展，如果现状已经满足剪枝窗口条件，直接剪枝
    if (board.sideToMove === 'w') {
      if (standPat >= beta) return beta
      alpha = Math.max(alpha, standPat)
    } else {
      if (standPat <= alpha) return alpha
      beta = Math.min(beta, standPat)
    }

    // 仅获取吃子的合法走法
    const captureMoves = this._getCaptureMoves(board)
    // 对吃子进行 MVV-LVA 排序
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

  /**
   * 走法启发式排序 (Move Ordering)
   * 
   * 将能够产生最好效果的走法（如：吃子、吃大子）优先排列在前面。
   * 在 Alpha-Beta 搜索中，如果最先搜索的是好子，Beta/Alpha 剪枝就会以极高的概率在极早的阶段被触发，
   * 从而节省 90% 以上的多余节点搜索开销。
   * 
   * 核心算法：吃子优先，且符合 MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
   * - 价值公式：被吃棋子价值 * 10 - 攻击棋子价值
   * - 比如：“兵”吃“车”的分值是 90 (车9 * 10 - 兵1)
   * - “车”吃“车”的分值是 81 (车9 * 10 - 车9)
   * - 显然“兵吃车”更加划算，排在最前面！
   * 
   * @param board 模拟当前的虚拟盘面
   * @param moves 待排序的合法走法集合
   * @returns 排序完毕的走法集合
   */
  private _orderMoves(board: Board, moves: Move[]): Move[] {
    const scores = new Map<Move, number>()
    
    for (const move of moves) {
      let score = 0
      const target = board.getPiece(move.to_row, move.to_col)
      if (target !== null) {
        // 如果是吃子走法，依据 MVV-LVA 评分
        const attackerValue = this._getPieceValue(board.getPiece(move.from_row, move.from_col))
        const victimValue = this._getPieceValue(target)
        score += victimValue * 10 - attackerValue
      }
      
      scores.set(move, score)
    }

    // 降序排序，分值最高的走法优先排在数组最前
    return moves.sort((a, b) => (scores.get(b) || 0) - (scores.get(a) || 0))
  }

  /**
   * 过滤出当前盘面中所有的吃子走法 (Capture Moves)
   */
  private _getCaptureMoves(board: Board): Move[] {
    const legalMoves = board.generateLegalMoves()
    return legalMoves.filter(m => board.getPiece(m.to_row, m.to_col) !== null)
  }

  /**
   * 对吃子走法单独进行 MVV-LVA 启发式排序（静态搜索专用）
   */
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

  /**
   * 获取棋子的静态静态评估分值价值
   * 
   * 棋子分值参考：车 900，马 400，炮 450，相 250，仕 250，兵 100，帅 100000
   */
  private _getPieceValue(piece: PieceType): number {
    if (piece === null) return 0
    return Evaluator.PIECE_VALUES[piece.toUpperCase()] || 0
  }

  /**
   * 辅助函数：检测在此盘面下，当前行棋方是否正在威胁对手的“大子”（车、马、炮）
   * 
   * 这是为了实现象棋中“捉” (Threaten/Chasing) 状态的检测。
   * “长捉”是指在重复局面中一方反复威胁对手的重要攻击棋子。
   */
  private _isThreateningMajorPiece(board: Board, side: 'w' | 'b'): boolean {
    const tempBoard = new Board()
    // 拷贝棋盘状态
    tempBoard.squares = board.squares.map(row => [...row])
    tempBoard.sideToMove = side

    // 检查我方下一步的所有合法走子
    const legalMoves = tempBoard.generateLegalMoves()
    for (const move of legalMoves) {
      const targetPiece = tempBoard.getPiece(move.to_row, move.to_col)
      if (targetPiece !== null) {
        const type = targetPiece.toUpperCase()
        // R: Chariot (车), H: Horse (马), C: Cannon (炮)
        // 如果能够走到能吃对方车、马、炮的位置，说明存在着明显的“捉子”威胁
        if (type === 'R' || type === 'H' || type === 'C') {
          return true
        }
      }
    }
    return false
  }

  /**
   * 判定此步走法是否为“攻击性走法”（即是否属于“将”或“捉”）
   * 
   * 这是判定中国象棋中“长攻犯规规则”的关键。
   * - 如果有重复局面产生，但玩家的重复走法纯粹是“闲着”（如闲移将/相/仕，没有做出任何威胁攻击），则是合法和棋局面。
   * - 但如果玩家每一轮都在“将军”或“捉大子”，则被判定为“长将”或“长捉”，属于犯规，必须被迫变着。
   * 
   * @param newBoard 模拟走完这一步之后的新盘面
   * @param side 当前这一步的进攻方颜色 ('w' 或 'b')
   * @returns true 如果这是一次有威胁的将/捉攻击，否则返回 false
   */
  private _isAttackingMove(newBoard: Board, side: 'w' | 'b'): boolean {
    const opponent = side === 'w' ? 'b' : 'w'
    
    // 1. 将军检测 (Check)
    if (newBoard.isInCheck(opponent)) {
      return true
    }
    
    // 2. 捉子检测 (Threaten opponent's major pieces)
    // 如果这一步造成了捉对方的车、马、炮，则也判定为攻击步
    if (this._isThreateningMajorPiece(newBoard, side)) {
      return true
    }
    
    return false
  }
}