/**
 * Stores the backend server URL for all LLM operations.
 * Keys are no longer stored in the frontend — they live server-side.
 */

const STORAGE_KEY = 'chinese-chess:llm-connection:v2'

const DEFAULT_BACKEND_URL = 'http://127.0.0.1:8000'

interface ConnStore {
  version: 2
  backendUrl: string
}

function load(): ConnStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { version: 2, backendUrl: DEFAULT_BACKEND_URL }
    const parsed = JSON.parse(raw) as ConnStore
    if (parsed.version !== 2 || !parsed.backendUrl) {
      return { version: 2, backendUrl: DEFAULT_BACKEND_URL }
    }
    return parsed
  } catch {
    return { version: 2, backendUrl: DEFAULT_BACKEND_URL }
  }
}

function save(store: ConnStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function getBackendUrl(): string {
  return load().backendUrl
}

export function saveBackendUrl(url: string): void {
  const trimmed = url.replace(/\/+$/, '')
  if (!trimmed) return
  save({ version: 2, backendUrl: trimmed })
}
