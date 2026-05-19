/**
 * Complex game sequence test — plays through increasingly long games
 * and checks if the LLM returns legal moves for each position.
 * PENs are pre-validated (computed via zh-chess engine externally).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { AddressInfo } from 'node:net'
import app from '../app.js'
import { getLegalMovesFromPen, findLegalMove, getLegalMoveNotations, renderBoardAsText } from '../utils/penValidator.js'
import type { PieceSide } from 'zh-chess'

let server: ReturnType<typeof app.listen>
let port: number

beforeAll(async () => {
  server = app.listen(0)
  port = (server.address() as AddressInfo).port
})

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

const BASE = () => `http://127.0.0.1:${port}`

// ---------------------------------------------------------------------------
// Game steps with pre-validated PENs (computed via zh-chess engine externally).
// Increasing in length: 1, 6, 10, 12, 20, 30, 40 moves of history.
// ---------------------------------------------------------------------------

interface GameStep {
  label: string
  pen: string
  side: PieceSide
  history: Array<{ side: PieceSide; notation: string }>
  moveCount: number
}

const ALL_STEPS: GameStep[] = [
  {
    label: '开局 — 红方中炮后黑方应对（1步）',
    pen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/2B5C/1P1P1PP1P/1C5C1/9/RNBAKABNR b',
    side: 'BLACK',
    history: [{ side: 'RED', notation: '炮二平五' }],
    moveCount: 1,
  },
  {
    label: '开局 — 中炮对屏风马（6步）',
    pen: 'rnbakab1r/9/1cn3c2/p1p1p1p1p/9/2B5C/1P1P1PP1P/1C5C1/9/RNBAKABNR b',
    side: 'BLACK',
    history: [
      { side: 'RED', notation: '炮二平五' },
      { side: 'BLACK', notation: '马8进7' },
      { side: 'RED', notation: '马二进三' },
      { side: 'BLACK', notation: '车9平8' },
      { side: 'RED', notation: '车一平二' },
      { side: 'BLACK', notation: '马2进3' },
    ],
    moveCount: 6,
  },
  {
    label: '中局 — 双方展开（10步）',
    pen: '2bakab1r/4a4/1cn4c1/p1p1p3p/9/2B1P3C/1P1P1PP1P/1C7/9/RNBAKABNR w',
    side: 'RED',
    history: [
      { side: 'RED', notation: '炮二平五' },
      { side: 'BLACK', notation: '马8进7' },
      { side: 'RED', notation: '兵五进一' },
      { side: 'BLACK', notation: '炮8平5' },
      { side: 'RED', notation: '马二进三' },
      { side: 'BLACK', notation: '马2进3' },
      { side: 'RED', notation: '车一平二' },
      { side: 'BLACK', notation: '车9平8' },
      { side: 'RED', notation: '车二进六' },
      { side: 'BLACK', notation: '卒3进1' },
    ],
    moveCount: 10,
  },
  {
    label: '中局 — 双方展开（12步）',
    pen: 'rnb1k1bnr/4a4/1c3c1c1/p1ppp1ppp/9/2B5C/PPPPPPPPP/1C7/9/RNBAKABNR w',
    side: 'RED',
    history: [
      { side: 'RED', notation: '炮二平五' },
      { side: 'BLACK', notation: '马8进7' },
      { side: 'RED', notation: '马二进三' },
      { side: 'BLACK', notation: '车9平8' },
      { side: 'RED', notation: '车一平二' },
      { side: 'BLACK', notation: '马2进3' },
      { side: 'RED', notation: '兵七进一' },
      { side: 'BLACK', notation: '卒7进1' },
      { side: 'RED', notation: '车二进六' },
      { side: 'BLACK', notation: '炮8平9' },
      { side: 'RED', notation: '马八进七' },
      { side: 'BLACK', notation: '炮2进4' },
    ],
    moveCount: 12,
  },
  {
    label: '扩展中局 — 多子接触（20步）',
    pen: '2b1k1b2/4a4/2n1c3c/p1p3p1p/9/P1P1P3C/1P1P1PP1P/2C6/9/RNBAKABNR w',
    side: 'RED',
    history: [
      { side: 'RED', notation: '炮二平五' },
      { side: 'BLACK', notation: '炮8平5' },
      { side: 'RED', notation: '马二进三' },
      { side: 'BLACK', notation: '马8进7' },
      { side: 'RED', notation: '车一平二' },
      { side: 'BLACK', notation: '车9平8' },
      { side: 'RED', notation: '车二进六' },
      { side: 'BLACK', notation: '马2进3' },
      { side: 'RED', notation: '兵七进一' },
      { side: 'BLACK', notation: '卒7进1' },
      { side: 'RED', notation: '炮八平七' },
      { side: 'BLACK', notation: '车1平2' },
      { side: 'RED', notation: '马八进九' },
      { side: 'BLACK', notation: '炮2进4' },
      { side: 'RED', notation: '车二平三' },
      { side: 'BLACK', notation: '马7退8' },
      { side: 'RED', notation: '车三进一' },
      { side: 'BLACK', notation: '炮2平7' },
      { side: 'RED', notation: '相七进五' },
      { side: 'BLACK', notation: '炮5进4' },
    ],
    moveCount: 20,
  },
  {
    label: '长局 — 复杂局面（30步）',
    pen: '5k3/4a4/4c4/4c4/9/P1P6/1P1P1PP1P/2C6/9/RNBAKABNR w',
    side: 'RED',
    history: [
      { side: 'RED', notation: '炮二平五' },
      { side: 'BLACK', notation: '炮8平5' },
      { side: 'RED', notation: '马二进三' },
      { side: 'BLACK', notation: '马8进7' },
      { side: 'RED', notation: '车一平二' },
      { side: 'BLACK', notation: '车9平8' },
      { side: 'RED', notation: '车二进六' },
      { side: 'BLACK', notation: '马2进3' },
      { side: 'RED', notation: '兵七进一' },
      { side: 'BLACK', notation: '卒7进1' },
      { side: 'RED', notation: '车二平三' },
      { side: 'BLACK', notation: '炮5退1' },
      { side: 'RED', notation: '炮八平七' },
      { side: 'BLACK', notation: '车1平2' },
      { side: 'RED', notation: '马八进九' },
      { side: 'BLACK', notation: '炮2进4' },
      { side: 'RED', notation: '车九平八' },
      { side: 'BLACK', notation: '炮2平7' },
      { side: 'RED', notation: '车三进一' },
      { side: 'BLACK', notation: '象3进5' },
      { side: 'RED', notation: '炮七进四' },
      { side: 'BLACK', notation: '士4进5' },
      { side: 'RED', notation: '炮五进四' },
      { side: 'BLACK', notation: '马3进5' },
      { side: 'RED', notation: '车三平五' },
      { side: 'BLACK', notation: '炮7进3' },
      { side: 'RED', notation: '士四进五' },
      { side: 'BLACK', notation: '车2进7' },
      { side: 'RED', notation: '车五平三' },
      { side: 'BLACK', notation: '炮7平9' },
    ],
    moveCount: 30,
  },
  {
    label: '超长局 — 大量交换（40步）',
    pen: '5k3/4a4/4c4/4c4/9/P1P6/9/9/9/RNBAKABNR w',
    side: 'RED',
    history: [
      { side: 'RED', notation: '炮二平五' },
      { side: 'BLACK', notation: '炮8平5' },
      { side: 'RED', notation: '马二进三' },
      { side: 'BLACK', notation: '马8进7' },
      { side: 'RED', notation: '车一平二' },
      { side: 'BLACK', notation: '车9平8' },
      { side: 'RED', notation: '车二进六' },
      { side: 'BLACK', notation: '马2进3' },
      { side: 'RED', notation: '兵七进一' },
      { side: 'BLACK', notation: '卒7进1' },
      { side: 'RED', notation: '车二平三' },
      { side: 'BLACK', notation: '炮5退1' },
      { side: 'RED', notation: '炮八平七' },
      { side: 'BLACK', notation: '车1平2' },
      { side: 'RED', notation: '马八进九' },
      { side: 'BLACK', notation: '炮2进4' },
      { side: 'RED', notation: '车九平八' },
      { side: 'BLACK', notation: '炮2平7' },
      { side: 'RED', notation: '车三进一' },
      { side: 'BLACK', notation: '象3进5' },
      { side: 'RED', notation: '炮七进四' },
      { side: 'BLACK', notation: '士4进5' },
      { side: 'RED', notation: '炮五进四' },
      { side: 'BLACK', notation: '马3进5' },
      { side: 'RED', notation: '车三平五' },
      { side: 'BLACK', notation: '炮7进3' },
      { side: 'RED', notation: '士四进五' },
      { side: 'BLACK', notation: '车2进7' },
      { side: 'RED', notation: '车五平三' },
      { side: 'BLACK', notation: '炮7平9' },
      { side: 'RED', notation: '车三退二' },
      { side: 'BLACK', notation: '车8进8' },
      { side: 'RED', notation: '车八进三' },
      { side: 'BLACK', notation: '车2平5' },
      { side: 'RED', notation: '帅五进一' },
      { side: 'BLACK', notation: '炮9进2' },
      { side: 'RED', notation: '帅五退一' },
      { side: 'BLACK', notation: '车5进1' },
      { side: 'RED', notation: '帅五进一' },
      { side: 'BLACK', notation: '车8平5' },
    ],
    moveCount: 40,
  },
]

// ---------------------------------------------------------------------------
// Richer prompt builder
// ---------------------------------------------------------------------------

function buildRichMessages(
  positionPen: string,
  aiSide: PieceSide,
  moveHistory: Array<{ side: PieceSide; notation: string }>,
  lastError?: string,
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const sideLabel = aiSide === 'RED' ? '红方' : '黑方'
  const peiceSideMap: Record<PieceSide, string> = { RED: '红方', BLACK: '黑方' }

  const historyText =
    moveHistory.length === 0
      ? '（开局）'
      : moveHistory.map((m, i) => `${Math.floor(i / 2) + 1}. ${peiceSideMap[m.side]}: ${m.notation}`).join('\n')

  const legalMoves = getLegalMovesFromPen(positionPen, aiSide)
  const legalNotations = legalMoves.map(m => m.notation)

  const retryHint = lastError ? `\n\n【重要】上一步返回的着法「${lastError}」不合法，请勿重复。` : ''

  const boardVisual = renderBoardAsText(positionPen)

  const userContent = `你现在正在与人类玩家进行一局中国象棋对弈，你是${sideLabel}。

## 当前棋盘（· 表示空位）
\`\`\`
${boardVisual}
\`\`\`

## 对局历史（按顺序，第1步在最上面）
${historyText}
（共${moveHistory.length}步）

## 你的任务
你是${sideLabel}，请从当前位置走出下一步。
**重要：你必须从以下合法着法列表中选择一个，不能使用列表之外的着法！**

## 所有合法着法（供参考）
${legalNotations.join('、')}
（共${legalNotations.length}种可选着法）

## 输出要求
1. 使用标准中文象棋记谱（如"炮二平五"、"马8进7"）
2. 只输出 JSON，不要解释，不要 markdown
3. 格式：{"move":"你的着法"}${retryHint}`

  return [
    {
      role: 'system',
      content: '你是中国象棋AI引擎。当前你正与人类对弈。根据局面返回唯一的合法着法，以JSON格式返回，键名move，值为中文记谱。不要调用工具，不要解释，不要markdown。',
    },
    { role: 'user', content: userContent },
  ]
}

// ---------------------------------------------------------------------------
// Models to test
// ---------------------------------------------------------------------------

const MODELS_TO_TEST = [
  'qwen3-coder-next',
  'qwen3-coder-plus',
  'qwen3-max-2026-01-23',
  'kimi-k2.5',
]

const PROVIDER_ID = 'bailian'

// ---------------------------------------------------------------------------
// Test results
// ---------------------------------------------------------------------------

interface TestResult {
  model: string
  step: string
  side: PieceSide
  moveCount: number
  move: string
  elapsedMs: number
  valid: boolean
  legalMovesCount: number
  error: string | null
}

const allResults: TestResult[] = []

async function callAiMove(
  providerId: string,
  modelId: string,
  messages: Array<{ role: string; content: string }>,
  positionPen: string,
  moveSide: PieceSide,
): Promise<{ move: string; elapsedMs: number; error?: string }> {
  const started = Date.now()
  const res = await fetch(`${BASE()}/api/ai/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      providerId,
      modelId,
      messages,
      positionPen,
      moveSide,
    }),
  })

  const elapsed = Date.now() - started
  const data = await res.json()

  if (res.status !== 200) {
    throw new Error(data.error ?? `HTTP ${res.status}`)
  }

  if (data.error) {
    throw new Error(data.error)
  }

  return { move: data.move, elapsedMs: elapsed }
}

describe('llm / complex-game — 长局合法性验证', { timeout: 60_000 }, () => {
  for (const modelId of MODELS_TO_TEST) {
    describe(modelId, () => {
      for (const step of ALL_STEPS) {
        it(
          step.label,
          async () => {
            const messages = buildRichMessages(
              step.pen,
              step.side,
              step.history,
            )

            const legalNotations = getLegalMoveNotations(step.pen, step.side)

            let move = ''
            let elapsed = 0
            let error: string | null = null
            let valid = false

            try {
              const result = await callAiMove(
                PROVIDER_ID,
                modelId,
                messages,
                step.pen,
                step.side,
              )
              move = result.move
              elapsed = result.elapsedMs

              const match = findLegalMove(
                getLegalMovesFromPen(step.pen, step.side),
                move,
              )
              valid = !!match

              if (!valid) {
                error = `着法 "${move}" 不在 ${legalNotations.length} 个合法着法中`
              }
            } catch (err) {
              error = err instanceof Error ? err.message : String(err)
              elapsed = 30_000
            }

            allResults.push({
              model: modelId,
              step: step.label,
              side: step.side,
              moveCount: step.moveCount,
              move,
              elapsedMs: elapsed,
              valid,
              legalMovesCount: legalNotations.length,
              error,
            })

            if (valid) {
              console.log(
                `  [PASS] ${modelId.padEnd(22)} ${step.label.padEnd(50)} "${move}" (${elapsed}ms, ${legalNotations.length} legal)`,
              )
            } else {
              console.log(
                `  [FAIL] ${modelId.padEnd(22)} ${step.label.padEnd(50)} "${move || '(none)'} — ${error} (${elapsed}ms)`,
              )
            }

            expect(valid).toBe(true)
            expect(elapsed).toBeLessThan(10_000)
          },
          60_000,
        )
      }
    })
  }

  // Summary
  afterAll(() => {
    console.log('\n' + '='.repeat(115))
    console.log('复杂对局测试汇总')
    console.log('='.repeat(115))

    const lines: string[] = []
    lines.push(
      `${'模型'.padEnd(22)} ${'步骤'.padEnd(50)} ${'着法'.padEnd(10)} ${'耗时'.padEnd(8)} ${'历史步数'.padEnd(8)} ${'合法数'.padEnd(6)} 结果`,
    )
    lines.push('-'.repeat(115))

    for (const r of allResults) {
      const status = r.valid ? 'PASS' : 'FAIL'
      const move = r.move || '(无)'
      lines.push(
        `${r.model.padEnd(22)} ${r.step.padEnd(50)} ${move.padEnd(10)} ${String(r.elapsedMs).padEnd(8)} ${String(r.moveCount).padEnd(8)} ${String(r.legalMovesCount).padEnd(6)} ${status}${r.error ? ' — ' + r.error : ''}`,
      )
    }

    lines.push('')
    lines.push('每模型统计:')
    const modelStats = new Map<string, { total: number; count: number; pass: number }>()
    for (const r of allResults) {
      const entry = modelStats.get(r.model) ?? { total: 0, count: 0, pass: 0 }
      entry.count++
      entry.total += r.elapsedMs
      if (r.valid) entry.pass++
      modelStats.set(r.model, entry)
    }
    for (const [model, stats] of modelStats) {
      const avg = Math.round(stats.total / stats.count)
      lines.push(`  ${model}: 平均 ${avg}ms | 通过 ${stats.pass}/${stats.count}`)
    }

    console.log(lines.join('\n'))
    console.log('='.repeat(115))
  })
})
