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
    <section className="card">
      <h2>大模型</h2>
      <p className="hint">API Key 在后端服务器配置，前端仅选择模型和后端地址</p>

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
          placeholder="http://127.0.0.1:3001"
        />
        <span className="field-hint">后端服务器 URL，默认 http://127.0.0.1:3001</span>
      </label>

      <label className="field">
        <span>提供商</span>
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
        <span>模型</span>
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
    </section>
  )
}
