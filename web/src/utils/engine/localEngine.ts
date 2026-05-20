import { normalizeFenForEngine, uciToNotation } from '../uciToNotation'
import { type AiMoveResult } from '../../llm/apiClient'

export async function requestAiMoveFromLocal(
  positionPen: string,
  history: string[] = [],
  maxTime: number = 3.0
): Promise<AiMoveResult> {
  const fen = normalizeFenForEngine(positionPen)
  
  return new Promise((resolve, reject) => {
    // Vite handles worker construction with ?worker suffix or new Worker(new URL(...))
    const worker = new Worker(new URL('./engine.worker.ts', import.meta.url), {
      type: 'module'
    })

    worker.onmessage = (e) => {
      const data = e.data
      worker.terminate()

      if (data.success) {
        const moveInfo = uciToNotation(positionPen, data.bestMove)
        resolve({
          move: moveInfo.notation,
          moveInfo: moveInfo,
          rawContent: `本地引擎 (Web Worker)\n最佳走法 (UCI): ${data.bestMove}\n评分: ${data.score}\n深度: ${data.depth}\n节点: ${data.nodesSearched}\n耗时: ${data.time.toFixed(2)}s`,
          fullPrompt: `FEN: ${fen}\nUCI: ${data.bestMove}`
        })
      } else {
        reject(new Error(data.error || '本地引擎运行失败'))
      }
    }

    worker.onerror = (err) => {
      worker.terminate()
      reject(err)
    }

    worker.postMessage({ fen, maxTime, depth: 6, history })
  })
}
