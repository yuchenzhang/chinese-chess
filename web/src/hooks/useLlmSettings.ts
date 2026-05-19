import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getFallbackDefaultProvider,
  getFallbackProviderById,
} from '../config/llmProviders'
import { fetchProviders, type LlmProviderInfo } from '../llm/apiClient'
import {
  getBackendUrl,
  saveBackendUrl,
} from '../storage/llmConnectionStore'
import {
  loadLlmSettings,
  saveLlmSettings,
  type LlmUserSettings,
} from '../storage/llmSettingsStore'

function toProviderInfo(p: LlmProviderInfo) {
  return {
    id: p.id,
    name: p.name,
    models: p.models.map((m) => ({ id: m.id, label: m.name })),
  }
}

export function useLlmSettings() {
  const [settings, setSettings] = useState<LlmUserSettings>(loadLlmSettings)
  const [providers, setProviders] = useState<Array<ReturnType<typeof toProviderInfo>>>(
    () => {
      const fallback = getFallbackProviderById(settings.providerId)
        ?? getFallbackDefaultProvider()
      return [toProviderInfo({
        id: fallback.id,
        name: fallback.name,
        models: fallback.models.map((m) => ({ id: m.id, name: m.label })),
        configured: true,
      })]
    },
  )
  const [backendUrl, setBackendUrl] = useState(getBackendUrl)
  const [backendUrlInput, setBackendUrlInput] = useState(backendUrl)

  // Fetch providers from backend on mount / URL change
  useEffect(() => {
    let cancelled = false
    fetchProviders().then((remote) => {
      if (cancelled) return
      setProviders(remote.map(toProviderInfo))
    }).catch(() => {
      // Keep fallback providers
    })
    return () => { cancelled = true }
  }, [settings.providerId])

  const provider = useMemo(
    () => providers.find((p) => p.id === settings.providerId) ?? providers[0],
    [providers, settings.providerId],
  )

  const persistSettings = useCallback((next: LlmUserSettings) => {
    setSettings(next)
    saveLlmSettings(next)
  }, [])

  const setProviderId = useCallback(
    (providerId: string) => {
      const p = providers.find((x) => x.id === providerId) ?? providers[0]
      const model = p.models.length > 0 ? p.models[0] : { id: '', label: '' }
      persistSettings({ providerId, modelId: model.id })
    },
    [persistSettings, providers],
  )

  const setModelId = useCallback(
    (modelId: string) => {
      persistSettings({ ...settings, modelId })
    },
    [persistSettings, settings],
  )

  const commitBackendUrl = useCallback(() => {
    const trimmed = backendUrlInput.replace(/\/+$/, '')
    if (!trimmed) {
      setBackendUrlInput(getBackendUrl())
      return
    }
    saveBackendUrl(trimmed)
    setBackendUrl(trimmed)
  }, [backendUrlInput])

  return {
    settings,
    provider,
    providers,
    backendUrl,
    backendUrlInput,
    setBackendUrlInput,
    commitBackendUrl,
    setProviderId,
    setModelId,
  }
}
