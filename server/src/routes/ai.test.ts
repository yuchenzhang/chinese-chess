import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { AddressInfo } from 'node:net'
import app from './app.js'

let server: ReturnType<typeof app.listen>
let port: number

beforeAll(async () => {
  server = app.listen(0) // random port
  port = (server.address() as AddressInfo).port
  process.env.TEST_PORT = String(port)
})

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

const BASE = () => `http://127.0.0.1:${process.env.TEST_PORT}`

describe('routes / health', () => {
  it('returns ok', async () => {
    const res = await fetch(`${BASE()}/api/health`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })
})

describe('routes / ai/providers', () => {
  it('lists all providers', async () => {
    const res = await fetch(`${BASE()}/api/ai/providers`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(3)
    expect(body[0].id).toBe('bailian')
    expect(body[0]).toHaveProperty('configured', true)
  })
})

describe('routes / ai/ping', () => {
  it('pings dashscope via API', async () => {
    const res = await fetch(`${BASE()}/api/ai/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: 'dashscope' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.provider).toBe('千问 DashScope')
  }, 30_000)
})

describe('routes / ai/move', () => {
  it('returns 400 for missing fields', async () => {
    const res = await fetch(`${BASE()}/api/ai/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for unknown provider', async () => {
    const res = await fetch(`${BASE()}/api/ai/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: 'unknown', modelId: 'x', messages: [] }),
    })
    expect(res.status).toBe(400)
  })

  it('returns move from dashscope', async () => {
    const res = await fetch(`${BASE()}/api/ai/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId: 'dashscope',
        modelId: 'qwen-turbo',
        messages: [
          { role: 'system' as const, content: '你是中国象棋引擎。只返回 JSON：{"move":"炮二平五"}' },
          { role: 'user' as const, content: '当前局面（PEN）：rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1\n你是红方，请走出下一步。' },
        ],
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('move')
    expect(typeof body.move).toBe('string')
    expect(body.move.length).toBeGreaterThan(0)
    console.log(`[move] ${body.move}`)
  }, 30_000)
})
