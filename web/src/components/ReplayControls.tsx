import type { UseReplayResult } from '../hooks/useReplay'
import type { GameSession } from '../types/gameSession'
import { exportGameRecord } from '../utils/exportGameRecord'

const SPEED_OPTIONS = [
  { value: 2000, label: '0.5x' },
  { value: 1000, label: '1x' },
  { value: 500, label: '2x' },
  { value: 250, label: '4x' },
]

interface ReplayControlsProps {
  replay: UseReplayResult
  session: GameSession
}

export function ReplayControls({ replay, session }: ReplayControlsProps) {
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

  const handleExport = () => {
    const markdown = exportGameRecord(session)
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${session.title || '棋局记录'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopyExport = async () => {
    const markdown = exportGameRecord(session)
    await navigator.clipboard.writeText(markdown)
  }

  if (!isReplaying) {
    return (
      <div className="replay-entry-row">
        <button
          type="button"
          className="btn btn-replay-enter"
          onClick={enterReplay}
          disabled={totalPlies === 0}
          title={totalPlies === 0 ? '当前对局暂无走子记录' : '回放本局棋谱'}
        >
          ▶ 回放棋局
        </button>
      </div>
    )
  }

  return (
    <div className="replay-panel">
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

      <div className="replay-export">
        <button
          type="button"
          className="btn btn-sm btn-export"
          onClick={handleExport}
          title="下载棋局记录（Markdown 格式，可供 AI 教练批注）"
        >
          📥 导出记录
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={handleCopyExport}
          title="复制棋局记录到剪贴板"
        >
          📋 复制
        </button>
      </div>
    </div>
  )
}
