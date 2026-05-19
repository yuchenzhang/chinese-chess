/**
 * API keys are now stored server-side in server/src/config/llmProviders.json.
 * This file is kept as a stub — the frontend no longer holds API keys.
 */

export function hasApiKey(_providerId: string): boolean {
  return true
}

export function getApiKey(_providerId: string): string | null {
  return null
}

export function saveApiKey(_providerId: string, _apiKey: string): void {
  // No-op: API keys are managed server-side
}

export function clearApiKey(_providerId: string): void {
  // No-op
}
