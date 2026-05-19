import { useLlmSettings } from '../hooks/useLlmSettings'

export function LlmSettings() {
  const {
    settings,
    provider,
    providers,
    backendUrlInput,
    setBackendUrlInput,
    commitBackendUrl,
    setProviderId,
    setModelId,
  } = useLlmSettings()

  return (
    <details className="card" open>
      <summary style={{ cursor: 'pointer' }}><h2 style={{ display: 'inline', margin: 0 }}>AI 引擎</h2></summary>
      <p className="hint" style={{ marginTop: '0.5rem' }}>配置后端决策引擎地址和模型参数</p>

      <label className="field">
        <span>后端地址</span>
        <input
          type="text"
          className="text-input"
          value={backendUrlInput}
          onChange={(e) => setBackendUrlInput(e.target.value)}
          onBlur={commitBackendUrl}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitBackendUrl()
          }}
          placeholder="http://127.0.0.1:8000"
        />
        <span className="field-hint">决策引擎 URL，默认 http://127.0.0.1:8000</span>
      </label>

      <label className="field">
        <span>引擎类型</span>
        <select
          value={settings.providerId}
          onChange={(e) => setProviderId(e.target.value)}
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>参数</span>
        <select
          value={settings.modelId}
          onChange={(e) => setModelId(e.target.value)}
        >
          {provider.models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
    </details>
  )
}
