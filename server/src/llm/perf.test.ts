import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { AddressInfo } from 'node:net'
import app from '../app.js'

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
// Real-game move sequences — exactly what the frontend sends after each turn
// ---------------------------------------------------------------------------

const GAME_SEQUENCE = [
  {
    label: '第1步 — AI 回应（黑方）',
    pen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w',
    side: 'BLACK' as const,
    moves: [] as Array<{ side: 'RED' | 'BLACK'; penCode: string; inCheck: boolean }>,
  },
]

function buildFullMessages(
  pen: string,
  sideLabel: string,
  moveHistory: Array<{ side: 'RED' | 'BLACK'; penCode: string; inCheck: boolean }>,
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const peiceSideMap: Record<string, string> = { RED: '红方', BLACK: '黑方' }
  const historyText =
    moveHistory.length === 0
      ? '（尚无走子）'
      : moveHistory
          .map((m, i) => `${i + 1}. ${peiceSideMap[m.side]}: ${m.penCode}`)
          .join('\n')

  return [
    {
      role: 'system' as const,
      content:
        '你是中国象棋对弈引擎助手。当前你正与人类玩家进行一局中国象棋对弈。根据局面只返回合法着法的 JSON，键名 move，值为中文记谱字符串。不要调用工具，不要解释。',
    },
    {
      role: 'user' as const,
      content: `当前局面（PEN）：
${pen}

走子记录：
${historyText}

你是${sideLabel}，请走出下一步。要求：
1. 使用标准中文象棋记谱（如「炮二平五」「马８进７」，数字可用半角或全角）
2. 只输出 JSON，不要 markdown，不要解释
3. 格式：{"move":"你的着法"}`,
    },
  ]
}

// ---------------------------------------------------------------------------
// Providers & models to test
// ---------------------------------------------------------------------------

const PROVIDERS = [
  {
    providerId: 'bailian',
    name: '百炼 Coding Plan',
    models: [
      'qwen3.6-plus',
      'qwen3.5-plus',
      'qwen3-max-2026-01-23',
      'qwen3-coder-next',
      'qwen3-coder-plus',
      'MiniMax-M2.5',
      'glm-5',
      'glm-4.7',
      'kimi-k2.5',
    ],
  },
]

// ---------------------------------------------------------------------------
// Performance test
// ---------------------------------------------------------------------------

interface PerfResult {
  provider: string
  model: string
  step: string
  move: string
  elapsedMs: number
  success: boolean
  error: string | null
}

const results: PerfResult[] = []

async function callAiMove(
  providerId: string,
  modelId: string,
  messages: Array<{ role: string; content: string }>,
): Promise<{ move: string; elapsedMs: number }> {
  const started = Date.now()
  const res = await fetch(`${BASE()}/api/ai/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId, modelId, messages }),
  })

  const elapsed = Date.now() - started

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }

  const data = await res.json()
  return { move: data.move, elapsedMs: elapsed }
}

describe('llm / performance — 完整对弈流程响应速度', () => {
  const TIMEOUT_MS = 30_000

  for (const provider of PROVIDERS) {
    describe(provider.name, () => {
      for (const modelId of provider.models) {
        for (const step of GAME_SEQUENCE) {
          it(
            `${step.label} / ${modelId}`,
            async () => {
              const messages = buildFullMessages(
                step.pen,
                step.side === 'RED' ? '红方' : '黑方',
                step.moves,
              )

              let move = ''
              let elapsed = 0
              let error: string | null = null
              let success = false

              try {
                const result = await callAiMove(
                  provider.providerId,
                  modelId,
                  messages as never,
                )
                move = result.move
                elapsed = result.elapsedMs
                success = true
              } catch (err) {
                error = err instanceof Error ? err.message : String(err)
                elapsed = 120_000
              }

              results.push({
                provider: provider.name,
                model: modelId,
                step: step.label,
                move,
                elapsedMs: elapsed,
                success,
                error,
              })

              // Log result for the test output
              if (success) {
                console.log(
                  `✅ ${provider.name} / ${modelId} — ${step.label}: "${move}" (${elapsed}ms)`,
                )
              } else {
                console.log(
                  `❌ ${provider.name} / ${modelId} — ${step.label}: ${error}`,
                )
              }

              expect(success).toBe(true)
              expect(move.length).toBeGreaterThan(0)
            },
            TIMEOUT_MS,
          )
        }
      }
    })
  }

  // Summary after all tests
  afterAll(() => {
    console.log('\n' + '='.repeat(80))
    console.log('性能测试汇总')
    console.log('='.repeat(80))

    const table: string[] = []
    table.push(
      `${'提供商'.padEnd(22)} ${'模型'.padEnd(20)} ${'步骤'.padEnd(30)} ${'着法'.padEnd(10)} ${'耗时(ms)'.padEnd(10)} 状态`,
    )
    table.push('-'.repeat(110))

    for (const r of results) {
      const status = r.success ? '✅' : '❌'
      const move = r.move || '(无)'
      table.push(
        `${r.provider.padEnd(22)} ${r.model.padEnd(20)} ${r.step.padEnd(30)} ${move.padEnd(10)} ${String(r.elapsedMs).padEnd(10)} ${status}${r.error ? ' ' + r.error : ''}`,
      )
    }

    // Averages per provider+model
    table.push('')
    table.push('平均耗时:')
    const avgMap = new Map<string, { total: number; count: number }>()
    for (const r of results) {
      const key = `${r.provider} / ${r.model}`
      const entry = avgMap.get(key) ?? { total: 0, count: 0 }
      entry.total += r.elapsedMs
      entry.count++
      avgMap.set(key, entry)
    }
    for (const [key, val] of avgMap) {
      const avg = Math.round(val.total / val.count)
      table.push(`  ${key}: ${avg}ms (${val.count} 次)`)
    }

    console.log(table.join('\n'))
    console.log('='.repeat(80))
  })
})
