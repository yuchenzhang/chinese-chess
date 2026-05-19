/** 开发环境在浏览器控制台输出 LLM 请求/响应，便于对照 Hermes 日志 */

const ENABLED = import.meta.env.DEV

export function logLlm(label: string, data?: unknown): void {
  if (!ENABLED) return
  if (data === undefined) {
    console.log(`[象棋·LLM] ${label}`)
    return
  }
  console.log(`[象棋·LLM] ${label}`, data)
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return '***'
  return `${key.slice(0, 4)}…${key.slice(-4)}`
}
