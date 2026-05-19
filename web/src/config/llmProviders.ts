/**
 * Frontend provider model definitions.
 * The authoritative provider list lives in server/src/config/llmProviders.json.
 * This file provides fallback defaults; the actual list is fetched from the backend at runtime.
 */

export interface LlmModelOption {
  id: string
  label: string
}

export interface FrontendProviderInfo {
  id: string
  name: string
  models: LlmModelOption[]
}

/** Fallback providers used before the backend is reachable. */
export const FALLBACK_PROVIDERS: FrontendProviderInfo[] = [
  {
    id: 'bailian',
    name: '百炼 Coding Plan',
    models: [
      { id: 'qwen3-coder-next', label: 'qwen3-coder-next (推荐)' },
      { id: 'qwen3-max-2026-01-23', label: 'qwen3-max' },
      { id: 'qwen3-coder-plus', label: 'qwen3-coder-plus' },
      { id: 'kimi-k2.5', label: 'kimi-k2.5' },
    ],
  },
]

export function getFallbackProviderById(id: string): FrontendProviderInfo | undefined {
  return FALLBACK_PROVIDERS.find((p) => p.id === id)
}

export function getFallbackDefaultProvider(): FrontendProviderInfo {
  return FALLBACK_PROVIDERS[0]
}

export function getDefaultModelForProvider(provider: FrontendProviderInfo): LlmModelOption {
  return provider.models.length > 0 ? provider.models[0] : { id: '', label: '(无模型)' }
}
