import { Board } from './board'
import { AlphaBetaSearch } from './search'

self.onmessage = (e: MessageEvent) => {
  const { fen, maxTime, depth, history } = e.data

  try {
    const board = Board.fromFen(fen)
    const searcher = new AlphaBetaSearch(depth || 6)
    
    const startTime = performance.now()
    const [bestMove, score] = searcher.search(board, maxTime || 5.0, history || [])
    const elapsed = (performance.now() - startTime) / 1000

    if (bestMove) {
      self.postMessage({
        success: true,
        bestMove: bestMove.toUci(),
        score,
        depth: searcher.lastCompletedDepth,
        nodesSearched: searcher.nodesSearched,
        time: elapsed
      })
    } else {
      self.postMessage({
        success: false,
        error: 'No legal moves available'
      })
    }
  } catch (error: any) {
    self.postMessage({
      success: false,
      error: error.message || 'Engine error'
    })
  }
}
