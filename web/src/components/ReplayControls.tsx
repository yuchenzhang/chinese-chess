import type { UseReplayResult } from '../hooks/useReplay'

const SPEED_OPTIONS = [
  { value: 2000, label: '0.5x' },
  { value: 1000, label: '1x' },
  { value: 500, label: '2x' },
  { value: 250, label: '4x' },
]

interface ReplayControlsProps {
  replay: UseReplayResult
}

export function ReplayControls({ replay }: ReplayControlsProps) {
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
          style={{ width: '100%' }}
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
    </div>
  )
}
