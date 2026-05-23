import { useState, useMemo, useEffect, useRef } from 'react'
import { evaluatePosition } from '../utils/evaluation'
import type { GameSession } from '../types/gameSession'
import type { UseReplayResult } from '../hooks/useReplay'

interface TrendChartProps {
  session: GameSession
  replay: UseReplayResult
  onShowExplanation?: () => void
  onRollback?: (targetPly: number) => void
}

interface ChartPoint {
  ply: number
  score: number
  clampedScore: number
  side?: 'RED' | 'BLACK'
  notation: string
  x: number
  y: number
  isTurningPoint: boolean
  turningPointType?: 'brilliant' | 'mistake' | 'reversal'
  turningPointDesc?: string
}

export function TrendChart({ session, replay, onShowExplanation, onRollback }: TrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const scrollWrapperRef = useRef<HTMLDivElement>(null)

  // 1. Construct the complete timeline of evaluation scores
  const points: ChartPoint[] = useMemo(() => {
    const history = session.moveHistory
    
    // Start FEN
    const initialPen = session.initialPen ?? 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w'
    const initialScore = evaluatePosition(initialPen)
    
    const chartData: Omit<ChartPoint, 'x' | 'y'>[] = [
      {
        ply: 0,
        score: initialScore,
        clampedScore: Math.max(-2000, Math.min(2000, initialScore)),
        notation: '初始开局',
        isTurningPoint: false
      }
    ]

    // Fill in historical scores
    history.forEach((move, idx) => {
      const ply = idx + 1
      const score = move.evaluation !== undefined ? move.evaluation : evaluatePosition(move.penCode)
      const clampedScore = Math.max(-2000, Math.min(2000, score))
      
      chartData.push({
        ply,
        score,
        clampedScore,
        side: move.side,
        notation: move.notation,
        isTurningPoint: false
      })
    })

    // 2. Identify Turning Points (kept in data for tooltip text only, no UI markers)
    for (let i = 1; i < chartData.length; i++) {
      const current = chartData[i]
      const prev = chartData[i - 1]
      const delta = current.score - prev.score
      
      if (Math.sign(current.score) !== Math.sign(prev.score) && current.score !== 0 && prev.score !== 0) {
        current.isTurningPoint = true
        current.turningPointType = 'reversal'
        current.turningPointDesc = `优势易主`
        continue
      }

      if (current.side === 'RED') {
        if (delta >= 180) {
          current.isTurningPoint = true
          current.turningPointType = 'brilliant'
          current.turningPointDesc = `红方妙手 +${delta.toFixed(0)}`
        } else if (delta <= -180) {
          current.isTurningPoint = true
          current.turningPointType = 'mistake'
          current.turningPointDesc = `红方失误 ${delta.toFixed(0)}`
        }
      } else {
        if (delta <= -180) {
          current.isTurningPoint = true
          current.turningPointType = 'brilliant'
          current.turningPointDesc = `黑方妙手 +${Math.abs(delta).toFixed(0)}`
        } else if (delta >= 180) {
          current.isTurningPoint = true
          current.turningPointType = 'mistake'
          current.turningPointDesc = `黑方失误 -${delta.toFixed(0)}`
        }
      }
    }

    // 3. Map to SVG Coordinates with dynamic width
    // Each step gets 25px of horizontal space to ensure high readability
    const count = chartData.length
    const chartWidth = Math.max(500, count * 25)
    const margin = { left: 25, right: 25, top: 15, bottom: 15 }
    const width = chartWidth - margin.left - margin.right
    const height = 120 - margin.top - margin.bottom
    const midY = margin.top + height / 2 // Y = 60

    return chartData.map((d, idx) => {
      const x = count <= 1 
        ? margin.left + width / 2
        : margin.left + (idx / (count - 1)) * width
      
      const y = midY - (d.clampedScore / 2000) * (height / 2)
      
      return {
        ...d,
        x,
        y
      } as ChartPoint
    })
  }, [session.moveHistory, session.initialPen])

  // Get dynamic chart width
  const chartWidth = useMemo(() => Math.max(500, points.length * 25), [points])

  // Get current active ply
  const activePly = replay.isReplaying ? replay.currentPly : session.moveHistory.length

  // Find active score
  const currentActivePoint = points[Math.min(activePly, points.length - 1)]
  const activeScore = currentActivePoint?.score ?? 0
  const isRedAdvantage = activeScore > 0
  const advantageText = Math.abs(activeScore) < 50 
    ? '势均力敌' 
    : (isRedAdvantage ? `红方优势 +${Math.abs(activeScore).toFixed(0)}` : `黑方优势 +${Math.abs(activeScore).toFixed(0)}`)

  // Smooth auto-centering on active ply in scroll view
  useEffect(() => {
    const wrapper = scrollWrapperRef.current
    if (!wrapper || points.length === 0) return

    const activePoint = points[Math.min(activePly, points.length - 1)]
    if (!activePoint) return

    const containerWidth = wrapper.clientWidth
    const targetScrollLeft = activePoint.x - containerWidth / 2
    
    wrapper.scrollTo({
      left: targetScrollLeft,
      behavior: 'smooth'
    })
  }, [activePly, points])

  // Construct Clean Line Path
  const linePath = useMemo(() => {
    if (points.length === 0) return ''
    if (points.length === 1) {
      return `M 25 60 H ${chartWidth - 25}`
    }
    return points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  }, [points, chartWidth])

  // Scrubbing coordinate handler
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (points.length === 0) return
    const svgX = e.nativeEvent.offsetX

    let closestIdx = 0
    let minDiff = Infinity
    points.forEach((p, idx) => {
      const diff = Math.abs(p.x - svgX)
      if (diff < minDiff) {
        minDiff = diff
        closestIdx = idx
      }
    })
    setHoveredIndex(closestIdx)
  }

  const handleMouseLeave = () => {
    setHoveredIndex(null)
  }

  const handlePointClick = (idx: number) => {
    if (idx === activePly && replay.isReplaying) return
    if (!replay.isReplaying) {
      replay.enterReplay()
    }
    replay.goToPly(idx)
  }

  const activePoint = points[activePly]

  return (
    <div className="trend-chart-container">
      {/* Header */}
      <div className="trend-chart-header">
        <div className="trend-chart-title-area">
          <span className="trend-title-text">📊 局势走势图</span>
          <span className={`trend-advantage-pill ${activeScore === 0 ? 'equal' : (isRedAdvantage ? 'red-adv' : 'black-adv')}`}>
            {advantageText}
          </span>
          {replay.isReplaying && (
            <span className="trend-replay-indicator pulse-replay">
              👁️ 查看第 {replay.currentPly} 步 / 共 {replay.totalPlies} 步
            </span>
          )}
        </div>
        
        <div className="trend-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onRollback && replay.isReplaying && replay.currentPly < replay.totalPlies && (
            <button
              type="button"
              className="btn-soft-action glow-amber-btn btn-rollback-time"
              onClick={() => {
                onRollback(replay.currentPly)
                replay.exitReplay()
              }}
              title={`回退整个棋局到第 ${replay.currentPly} 步状态`}
              style={{
                fontSize: '0.75rem',
                fontWeight: '700',
                padding: '4px 12px',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
              }}
            >
              ⏳ 回退至此步
            </button>
          )}
          {onShowExplanation && (
            <button 
              className="eval-info-btn" 
              onClick={onShowExplanation}
              title="查看局势评估算法说明"
              aria-label="查看局势评估算法说明"
              style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', 
                cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Horizontally Scrollable Canvas Wrapper */}
      <div 
        className="trend-chart-canvas-wrapper" 
        ref={scrollWrapperRef}
        style={{ 
          position: 'relative', 
          overflowX: 'auto', 
          overflowY: 'hidden', 
          WebkitOverflowScrolling: 'touch' 
        }}
      >
        <svg 
          viewBox={`0 0 ${chartWidth} 120`}
          className="trend-chart-svg"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={() => hoveredIndex !== null && handlePointClick(hoveredIndex)}
          style={{ 
            width: `${chartWidth}px`, 
            height: '120px', 
            cursor: hoveredIndex !== null ? 'pointer' : 'default',
            display: 'block'
          }}
        >
          {/* Subtle Grid Horizontal Lines */}
          <line x1="10" y1="15" x2={chartWidth - 10} y2="15" stroke="rgba(255,255,255,0.03)" strokeDasharray="2,2" />
          <line x1="10" y1="37.5" x2={chartWidth - 10} y2="37.5" stroke="rgba(255,255,255,0.03)" strokeDasharray="2,2" />
          <line x1="10" y1="82.5" x2={chartWidth - 10} y2="82.5" stroke="rgba(255,255,255,0.03)" strokeDasharray="2,2" />
          <line x1="10" y1="105" x2={chartWidth - 10} y2="105" stroke="rgba(255,255,255,0.03)" strokeDasharray="2,2" />

          {/* Balance midline (Y = 0) */}
          <line 
            x1="10" 
            y1="60" 
            x2={chartWidth - 10} 
            y2="60" 
            stroke="rgba(255, 255, 255, 0.15)" 
            strokeWidth="1.2"
          />

          {/* Simple Clean Blue Line (No gradients, no animations) */}
          {points.length > 0 && (
            <path 
              d={linePath} 
              fill="none" 
              stroke="#3b82f6" 
              strokeWidth="2" 
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Active step vertical tracking line */}
          {activePoint && (
            <line 
              x1={activePoint.x} 
              y1="10" 
              x2={activePoint.x} 
              y2="110" 
              stroke="rgba(59, 130, 246, 0.4)" 
              strokeWidth="1.2" 
              strokeDasharray="2,2" 
            />
          )}

          {/* Highlight active step dot */}
          {activePoint && (
            <circle 
              cx={activePoint.x} 
              cy={activePoint.y} 
              r="4.5" 
              fill="#ffffff" 
              stroke="#3b82f6" 
              strokeWidth="2" 
            />
          )}

          {/* Hover Scrub vertical line & highlighted dot */}
          {hoveredIndex !== null && points[hoveredIndex] && (
            <>
              <line 
                x1={points[hoveredIndex].x} 
                y1="10" 
                x2={points[hoveredIndex].x} 
                y2="110" 
                stroke="rgba(255, 255, 255, 0.3)" 
                strokeWidth="1" 
              />
              <circle 
                cx={points[hoveredIndex].x} 
                cy={points[hoveredIndex].y} 
                r="4" 
                fill="#ffffff" 
                stroke="#60a5fa" 
                strokeWidth="1.5"
              />
            </>
          )}
        </svg>

        {/* Dynamic Minimal Tooltip */}
        {hoveredIndex !== null && points[hoveredIndex] && (
          <div 
            className="trend-chart-tooltip"
            style={{
              position: 'absolute',
              left: `${points[hoveredIndex].x}px`,
              bottom: '95px',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              animation: 'tooltipFadeIn 0.1s ease-out forwards',
              zIndex: 1000
            }}
          >
            <div className="trend-tooltip-card">
              <div className="trend-tooltip-header">
                <span className="trend-tooltip-ply">第 {points[hoveredIndex].ply} 步</span>
                <span className="trend-tooltip-notation">
                  {points[hoveredIndex].ply === 0 ? '初始开局' : `${points[hoveredIndex].side === 'RED' ? '🔴 红方' : '⚫ 黑方'} : ${points[hoveredIndex].notation}`}
                </span>
              </div>
              <div className="trend-tooltip-body">
                <span className="trend-tooltip-score">
                  局势估分: <strong style={{ color: points[hoveredIndex].score > 0 ? '#4ade80' : points[hoveredIndex].score < 0 ? '#60a5fa' : '#ffffff' }}>
                    {points[hoveredIndex].score > 0 ? `+${points[hoveredIndex].score.toFixed(0)}` : points[hoveredIndex].score.toFixed(0)}
                  </strong>
                </span>
                {points[hoveredIndex].isTurningPoint && points[hoveredIndex].turningPointDesc && (
                  <div className="trend-tooltip-alert">
                    <span className={`trend-alert-badge ${points[hoveredIndex].turningPointType}`}>
                      {points[hoveredIndex].turningPointType === 'brilliant' ? '👑 妙手' : points[hoveredIndex].turningPointType === 'mistake' ? '⚠️ 失误' : '⭐ 逆转'}
                    </span>
                    <p className="trend-alert-desc" style={{ color: 'rgba(255,255,255,0.85)' }}>
                      {points[hoveredIndex].turningPointDesc}
                    </p>
                  </div>
                )}
              </div>
              <div className="trend-tooltip-arrow" />
            </div>
          </div>
        )}
      </div>

      {/* Guide footer */}
      {points.length > 1 && (
        <div className="trend-chart-footer" style={{ marginTop: '6px', fontSize: '0.65rem' }}>
          <span>💡 滑动轨迹或拖动滚动条查看完整棋盘走势，点击折线即可瞬间跳转复盘。</span>
        </div>
      )}
    </div>
  )
}
