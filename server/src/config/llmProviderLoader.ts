import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface ProviderModel {
  id: string
  name: string
}

export interface LlmProviderConfig {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  models: ProviderModel[]
  apiPath: string
}

export interface LlmProvidersFile {
  providers: LlmProviderConfig[]
}

function resolveEnvVars(value: string): string {
  return value.replace(/^\$(.+)$/, (_, varName) => {
    const envValue = process.env[varName]
    if (!envValue) {
      console.warn(`[config] env var ${varName} is not set`)
    }
    return envValue ?? ''
  })
}

const raw = readFileSync(join(__dirname, 'llmProviders.json'), 'utf-8')
const parsed: LlmProvidersFile = JSON.parse(raw)

// Resolve $ENV_VAR references in apiKey and baseUrl
const config: LlmProvidersFile = {
  providers: parsed.providers.map((p) => ({
    ...p,
    baseUrl: resolveEnvVars(p.baseUrl),
    apiKey: resolveEnvVars(p.apiKey),
  })),
}

export function getProviderById(id: string): LlmProviderConfig | undefined {
  return config.providers.find((p) => p.id === id)
}

export function listProviders(): LlmProviderConfig[] {
  return config.providers
}
