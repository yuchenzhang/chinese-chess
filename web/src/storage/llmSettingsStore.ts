import {
  getDefaultModelForProvider,
  getFallbackDefaultProvider,
  getFallbackProviderById,
} from '../config/llmProviders'

const STORAGE_KEY = 'chinese-chess:llm-settings:v1'

export interface LlmUserSettings {
  providerId: string
  modelId: string
}

interface SettingsStore {
  version: 1
  settings: LlmUserSettings
}

function defaultSettings(): LlmUserSettings {
  const provider = getFallbackDefaultProvider()
  const model = getDefaultModelForProvider(provider)
  return { providerId: provider.id, modelId: model.id }
}

function load(): SettingsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { version: 1, settings: defaultSettings() }
    }
    const parsed = JSON.parse(raw) as SettingsStore
    if (parsed.version !== 1 || !parsed.settings?.providerId) {
      return { version: 1, settings: defaultSettings() }
    }
    const provider = getFallbackProviderById(parsed.settings.providerId)
    if (!provider) {
      return { version: 1, settings: defaultSettings() }
    }
    const modelExists = provider.models.some((m) => m.id === parsed.settings.modelId)
    if (!modelExists) {
      parsed.settings.modelId = getDefaultModelForProvider(provider).id
    }
    return parsed
  } catch {
    return { version: 1, settings: defaultSettings() }
  }
}

export function loadLlmSettings(): LlmUserSettings {
  return load().settings
}

export function saveLlmSettings(settings: LlmUserSettings): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, settings } satisfies SettingsStore),
  )
}
