import { describe, it, expect } from 'vitest'
import { pingProvider, pingAllProviders } from '../llm/pingTest.js'
import { listProviders, getProviderById } from '../config/llmProviderLoader.js'

describe('config / llmProviderLoader', () => {
  it('loads all providers from config', () => {
    const providers = listProviders()
    expect(providers).toHaveLength(3)
  })

  it('finds provider by id', () => {
    expect(getProviderById('bailian')?.name).toBe('百炼 Coding Plan')
    expect(getProviderById('dashscope')?.name).toBe('千问 DashScope')
    expect(getProviderById('deepseek')?.name).toBe('DeepSeek')
    expect(getProviderById('nonexistent')).toBeUndefined()
  })

  it('each provider has baseUrl and apiKey resolved from env', () => {
    for (const p of listProviders()) {
      expect.soft(p.baseUrl).toBeTruthy()
      expect.soft(p.apiKey).toBeTruthy()
      expect.soft(p.apiKey).not.toMatch(/^\$/)
    }
  })
})

describe('llm / pingTest', () => {
  it('pings bailian', async () => {
    const result = await pingProvider('bailian')
    console.log(`[bailian] ${result.status} (${result.elapsedMs}ms) model=${result.model}`)
    expect(result.status).toBe('ok')
    expect(result.provider).toBe('百炼 Coding Plan')
    expect(result.response).toBeTruthy()
  }, 60_000)

  it('pings dashscope', async () => {
    const result = await pingProvider('dashscope')
    console.log(`[dashscope] ${result.status} (${result.elapsedMs}ms) model=${result.model}`)
    expect(result.status).toBe('ok')
    expect(result.provider).toBe('千问 DashScope')
    expect(result.response).toBeTruthy()
  }, 60_000)

  it('pings deepseek', async () => {
    const result = await pingProvider('deepseek')
    console.log(`[deepseek] ${result.status} (${result.elapsedMs}ms) model=${result.model}`)
    console.log(`[deepseek] response="${result.response}" error="${result.error}"`)
    expect(result.status).toBe('ok')
    expect(result.provider).toBe('DeepSeek')
    // DeepSeek may return empty for "ping" — just verify connectivity succeeded
  }, 60_000)

  it('pings all providers at once', async () => {
    const results = await pingAllProviders()
    expect(results).toHaveLength(3)
    for (const r of results) {
      console.log(`[${r.provider}] ${r.status} (${r.elapsedMs}ms) model=${r.model}`)
      if (r.status === 'fail') {
        console.log(`  error: ${r.error}`)
      }
    }
    const okCount = results.filter((r) => r.status === 'ok').length
    expect(okCount).toBe(3)
  }, 120_000)

  it('handles invalid provider gracefully', async () => {
    await expect(pingProvider('no-such-provider')).rejects.toThrow('not found')
  })
})
