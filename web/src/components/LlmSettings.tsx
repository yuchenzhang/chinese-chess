import { useState } from 'react'
import { useLlmSettings } from '../hooks/useLlmSettings'
import { pingServer } from '../llm/apiClient'

interface LlmSettingsProps {
  onShowExplanation?: () => void
}

export function LlmSettings({ onShowExplanation }: LlmSettingsProps) {
  const {
    backendUrlInput,
    setBackendUrlInput,
    commitBackendUrl,
  } = useLlmSettings()

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleTestConnection = async () => {
    // Force commit URL first so the client uses the latest input value
    commitBackendUrl()
    
    setTestStatus('testing')
    setErrorMessage('')
    
    try {
      const info = await pingServer()
      setTestStatus('success')
      console.log('Backend Ping successful:', info)
    } catch (err: any) {
      setTestStatus('error')
      setErrorMessage(err.message || '连接服务器超时或拒绝连接')
    }
  }

  return (
    <details className="card" open data-tour="ai-settings">
      <summary style={{ cursor: 'pointer' }}><h2 style={{ display: 'inline', margin: 0 }}>远程引擎</h2></summary>
      <p className="hint" style={{ marginTop: '0.5rem' }}>配置高性能并行决策引擎后端服务地址</p>

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

        {/* Connection Testing Actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleTestConnection}
            disabled={testStatus === 'testing'}
            style={{ 
              padding: '4px 12px', 
              fontSize: '0.8rem', 
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {testStatus === 'testing' ? '正在测试...' : '一键测试'}
          </button>
          
          {testStatus === 'success' && (
            <span style={{ fontSize: '0.8rem', color: '#4ade80', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              🟢 连接成功 (引擎就绪)
            </span>
          )}
          
          {testStatus === 'error' && (
            <span style={{ fontSize: '0.8rem', color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: '4px' }} title={errorMessage}>
              🔴 连接失败: {errorMessage.slice(0, 24)}{errorMessage.length > 24 ? '...' : ''}
            </span>
          )}
        </div>

        {/* Backend Spec Prompt Guide Link */}
        {onShowExplanation && (
          <div style={{ marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            没有可用后端？查看
            <button
              type="button"
              className="btn-link"
              onClick={onShowExplanation}
              style={{
                background: 'none',
                border: 'none',
                padding: '0 2px',
                color: 'var(--accent)',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: '0.75rem',
                display: 'inline',
              }}
            >
              💡 算法解析
            </button>
            页面获取一键构建高性能后端的 Agent 提示词。
          </div>
        )}
      </label>
    </details>
  )
}
