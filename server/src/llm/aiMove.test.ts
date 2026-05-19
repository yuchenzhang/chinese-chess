import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { AddressInfo } from 'node:net'
import app from '../app.js'
import { getLegalMovesFromPen, findLegalMove } from '../utils/penValidator.js'

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

// Real PEN positions with expected legal move counts
const FIXTURES = [
  {
    name: '初始局面 — 红方先行',
    pen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w',
    side: 'RED' as const,
    minLegalMoves: 20,
  },
  {
    name: '中局 — 黑方走子',
    pen: '1rbaka2r/4nc3/2n1b4/p1p1c1p1p/2p5P/5C3/P1P1P3N/1C2B4/9/RNBAKA1NR b',
    side: 'BLACK' as const,
    minLegalMoves: 10,
  },
  {
    name: '残局 — 红方单车对黑将',
    pen: '4k4/9/9/9/9/9/9/9/9/R3K4 w',
    side: 'RED' as const,
    minLegalMoves: 5,
  },
]

describe('utils / penValidator', () => {
  it('parses positions and finds correct number of legal moves', () => {
    for (const f of FIXTURES) {
      const moves = getLegalMovesFromPen(f.pen, f.side)
      console.log(`[${f.name}] found ${moves.length} legal moves`)
      console.log(`  Sample: ${moves.slice(0, 8).map(m => m.notation).join(', ')}`)
      expect(moves.length).toBeGreaterThanOrEqual(f.minLegalMoves)
    }
  })

  it('generates correct Chinese notation', () => {
    const moves = getLegalMovesFromPen('rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w', 'RED')

    // Red cannon forward (4 steps)
    const cannonForward = moves.find(m => m.notation === '炮二进四')
    expect(cannonForward).toBeTruthy()

    // Red cannon horizontal
    const cannonHorizontal = moves.find(m => m.notation.startsWith('炮二平'))
    expect(cannonHorizontal).toBeTruthy()

    // Red horse
    const horseMove = moves.find(m => m.notation === '马二进三')
    expect(horseMove).toBeTruthy()

    console.log('Valid notations:', moves.slice(0, 10).map(m => m.notation).join(', '))
  })

  it('matches LLM moves with normalization (Chinese/Arabic numerals)', () => {
    const moves = getLegalMovesFromPen('rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w', 'RED')

    // Chinese numerals (standard)
    expect(findLegalMove(moves, '炮二平五')).toBeTruthy()
    expect(findLegalMove(moves, '马二进三')).toBeTruthy()

    // Arabic numerals (LLM sometimes returns)
    expect(findLegalMove(moves, '炮2平5')).toBeTruthy()
    expect(findLegalMove(moves, '马2进3')).toBeTruthy()
  })
})

/**
 * Build the prompt for LLM. Two versions:
 * 1. Simple: just PEN + side
 * 2. With legal moves: PEN + side + list of legal moves (reduces hallucination)
 */
function buildMovePrompt(pen: string, sideLabel: string, legalMoves: { notation: string }[], includeLegalMoves: boolean): string {
  const legalList = includeLegalMoves
    ? `\n\n可走的合法着法（参考）：\n${legalMoves.map(m => m.notation).join('、')}`
    : ''

  return `当前局面（PEN）：
${pen}

你是${sideLabel}，请走出下一步。要求：
1. 使用标准中文象棋记谱（如「炮二平五」「马8进7」）
2. 只输出 JSON，不要 markdown，不要解释
3. 格式：{"move":"你的着法"}${legalList}`
}

describe('llm / aiMove — PEN 理解力验证', () => {
  /**
   * Core integration test:
   * 1. Parse PEN → get all legal moves via zh-chess
   * 2. Send PEN + legal moves list to LLM via backend
   * 3. Verify LLM's response is in the legal moves list
   */
  it.each(FIXTURES)(
    'LLM returns a legal move: $name (with legal moves hint)',
    async ({ pen, side, minLegalMoves }) => {
      const legalMoves = getLegalMovesFromPen(pen, side)
      expect(legalMoves.length).toBeGreaterThanOrEqual(minLegalMoves)

      const sideLabel = side === 'RED' ? '红方' : '黑方'
      const messages = [
        {
          role: 'system' as const,
          content: '你是中国象棋对弈引擎助手。根据局面只返回合法着法的 JSON，键名 move，值为中文记谱字符串。不要调用工具，不要解释。',
        },
        {
          role: 'user' as const,
          content: buildMovePrompt(pen, sideLabel, legalMoves, true),
        },
      ]

      const res = await fetch(`${BASE()}/api/ai/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: 'dashscope',
          modelId: 'qwen-turbo',
          messages,
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      const llmMove = body.move as string

      console.log(`[${sideLabel}] LLM says: "${llmMove}"`)
      console.log(`  Legal moves (${legalMoves.length}): ${legalMoves.slice(0, 12).map(m => m.notation).join(', ')}${legalMoves.length > 12 ? '…' : ''}`)

      const match = findLegalMove(legalMoves, llmMove)
      if (!match) {
        console.log(`  ✗ MISMATCH — LLM returned illegal move: "${llmMove}"`)
        console.log(`  Full legal notations: ${legalMoves.map(m => m.notation).join(', ')}`)
      } else {
        console.log(`  ✓ Matched: ${match.notation}`)
      }

      expect(match, `LLM 返回的 "${llmMove}" 不是合法着法`).toBeTruthy()
    },
    30_000,
  )
})

describe('llm / aiMove — 无提示盲测', () => {
  /**
   * Harder version: don't give LLM the legal moves list.
   * Only send PEN + side. Tests pure PEN understanding.
   */
  it('LLM returns legal move from initial position (no hints)', async () => {
    const pen = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w'
    const side = 'RED' as const
    const legalMoves = getLegalMovesFromPen(pen, side)
    const sideLabel = '红方'

    const messages = [
      {
        role: 'system' as const,
        content: '你是中国象棋对弈引擎助手。根据局面只返回合法着法的 JSON，键名 move，值为中文记谱字符串。不要调用工具，不要解释。',
      },
      {
        role: 'user' as const,
        content: buildMovePrompt(pen, sideLabel, legalMoves, false),
      },
    ]

    const res = await fetch(`${BASE()}/api/ai/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId: 'dashscope',
        modelId: 'qwen-turbo',
        messages,
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    const llmMove = body.move as string

    console.log(`[盲测] LLM says: "${llmMove}"`)

    const match = findLegalMove(legalMoves, llmMove)
    if (!match) {
      console.log(`  ✗ MISMATCH — LLM returned: "${llmMove}"`)
      console.log(`  Legal moves: ${legalMoves.map(m => m.notation).join(', ')}`)
    }

    expect(match, `盲测中 LLM 返回的 "${llmMove}" 不是合法着法`).toBeTruthy()
  }, 30_000)
})
