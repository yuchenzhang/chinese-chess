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
    id: 'local-engine',
    name: '本地引擎 (浏览器 JS)',
    models: [
      { id: 'default', label: '默认搜索深度 (6层)' },
    ],
  },
  {
    id: 'rule-engine',
    name: '远程引擎 (Python)',
    models: [
      { id: 'default', label: '默认搜索深度' },
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
