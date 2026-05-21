import { useState } from 'react'
import type { UseReplayResult } from '../hooks/useReplay'
import type { GameSession, LlmAnalysis } from '../types/gameSession'
import { exportGameRecordForLlmPrompt } from '../utils/exportGameRecord'

const SPEED_OPTIONS = [
  { value: 2000, label: '0.5x' },
  { value: 1000, label: '1x' },
  { value: 500, label: '2x' },
  { value: 250, label: '4x' },
]

interface ReplayControlsProps {
  replay: UseReplayResult
  session: GameSession
  onImportAnalysis?: (analysis: LlmAnalysis) => void
}

export function ReplayControls({ replay, session, onImportAnalysis }: ReplayControlsProps) {
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const {
    isReplaying,
    currentPly,
    totalPlies,
    isPlaying,
    speed,
    enterReplay,
    exitReplay,
    goToStart,
    goToEnd,
    stepBackward,
    stepForward,
    togglePlay,
    setSpeed,
    goToPly,
  } = replay

  const handleExportPrompt = async () => {
    const prompt = exportGameRecordForLlmPrompt(session)
    try {
      await navigator.clipboard.writeText(prompt)
      alert('大模型提示词已复制到剪贴板！请直接粘贴给大模型。')
    } catch (err) {
      alert('复制失败，请重试')
    }
  }

  const handleImportSubmit = () => {
    try {
      setImportError('')
      const parsed = JSON.parse(importText)
      if (parsed.annotations && Array.isArray(parsed.annotations) && parsed.summary) {
        onImportAnalysis?.(parsed)
        setShowImport(false)
        setImportText('')
        alert('导入成功！在回放时可见大模型分析。')
      } else {
        setImportError('JSON 格式不正确，缺少 annotations (需为数组) 或 summary')
      }
    } catch (e) {
      setImportError('无效的 JSON 格式')
    }
  }

  if (!isReplaying) {
    return (
      <div className="replay-entry-row" data-tour="replay-entry">
        <button
          type="button"
          className="btn btn-replay-enter"
          onClick={enterReplay}
          disabled={totalPlies === 0}
          title={totalPlies === 0 ? '当前对局暂无走子记录' : '回放本局棋谱'}
          data-tour="enter-replay-btn"
        >
          ▶ 回放棋局
        </button>
      </div>
    )
  }

  return (
    <div className="replay-panel" data-tour="replay-panel">
      <div className="replay-header">
        <span className="replay-badge">回放模式</span>
        <button
          type="button"
          className="btn btn-sm replay-exit"
          onClick={exitReplay}
        >
          退出回放
        </button>
      </div>

      <div className="replay-progress">
        <input
          type="range"
          className="replay-slider"
          min={0}
          max={totalPlies}
          value={currentPly}
          onChange={(e) => goToPly(Number(e.target.value))}
        />
        <span className="replay-ply-label">
          {currentPly} / {totalPlies}
        </span>
      </div>

      <div className="replay-buttons">
        <button
          type="button"
          className="btn btn-sm"
          onClick={goToStart}
          disabled={currentPly === 0}
          title="回到开局"
        >
          ⏮
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={stepBackward}
          disabled={currentPly === 0}
          title="上一步"
        >
          ⏪
        </button>
        <button
          type="button"
          className="btn btn-sm replay-play-btn"
          onClick={togglePlay}
          title={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={stepForward}
          disabled={currentPly >= totalPlies}
          title="下一步"
        >
          ⏩
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={goToEnd}
          disabled={currentPly >= totalPlies}
          title="跳到最后"
        >
          ⏭
        </button>
      </div>

      <div className="replay-speed">
        <span className="replay-speed-label">速度:</span>
        {SPEED_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`btn btn-sm replay-speed-btn${speed === opt.value ? ' active' : ''}`}
            onClick={() => setSpeed(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="replay-export" data-tour="export-import-actions">
        <button
          type="button"
          className="btn btn-sm btn-export"
          onClick={handleExportPrompt}
          title="复制可直接发给大模型的复盘提示词"
        >
          📋 复制大模型提示词
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setShowImport(!showImport)}
          title="粘贴大模型返回的 JSON 分析结果"
          data-tour="import-analysis-btn"
        >
          📥 导入 AI 分析
        </button>
      </div>

      {showImport && (
        <div className="llm-import-panel">
          <p className="llm-import-title">粘贴 AI 教练返回的 JSON：</p>
          <textarea
            className="llm-import-textarea"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='{ "game_id": "...", "annotations": [...] }'
            rows={5}
          />
          {importError && <p className="llm-import-error" style={{ color: 'red', fontSize: '0.8rem', margin: '4px 0' }}>{importError}</p>}
          <div className="llm-import-actions" style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button type="button" className="btn btn-sm" onClick={handleImportSubmit}>保存分析</button>
            <button type="button" className="btn btn-sm" onClick={() => setShowImport(false)}>取消</button>
          </div>
        </div>
      )}
    </div>
  )
}
