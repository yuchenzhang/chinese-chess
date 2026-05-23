import { useState, useMemo, useEffect, useRef } from 'react'
import { evaluatePosition } from '../utils/evaluation'
import type { GameSession, MoveRecord } from '../types/gameSession'
import type { UseReplayResult } from '../hooks/useReplay'

interface TrendChartProps {
  session: GameSession
  replay: UseReplayResult
  onShowExplanation?: () => void
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

export function TrendChart({ session, replay, onShowExplanation }: TrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 1. Construct the complete timeline of evaluation scores
  const points: ChartPoint[] = useMemo(() => {
    const history = session.moveHistory
    const total = history.length
    
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
      // Use stored engine score, or fall back to local static evaluation
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

    // 2. Identify Turning Points (转折点)
    // - Brilliant shift: delta score >= 180 (for the moving player)
    // - Mistake shift: delta score <= -180 (for the moving player)
    // - Midline Reversal: Advantage crosses Y = 0
    for (let i = 1; i < chartData.length; i++) {
      const current = chartData[i]
      const prev = chartData[i - 1]
      const delta = current.score - prev.score
      const opponentSide = current.side === 'RED' ? 'BLACK' : 'RED'
      
      // Reversal check
      if (Math.sign(current.score) !== Math.sign(prev.score) && current.score !== 0 && prev.score !== 0) {
        current.isTurningPoint = true
        current.turningPointType = 'reversal'
        current.turningPointDesc = `优势逆转：双方均势打破或优势易主`
        continue
      }

      // Check for swings based on moving side
      // Positive score is good for Red (w), Negative is good for Black (b)
      if (current.side === 'RED') {
        if (delta >= 180) {
          current.isTurningPoint = true
          current.turningPointType = 'brilliant'
          current.turningPointDesc = `红方妙手：局势提升了 +${delta.toFixed(0)}`
        } else if (delta <= -180) {
          current.isTurningPoint = true
          current.turningPointType = 'mistake'
          current.turningPointDesc = `红方失误：局势恶化了 ${delta.toFixed(0)}`
        }
      } else {
        // Black's move. Negative delta means score went down, which is good for Black.
        if (delta <= -180) {
          current.isTurningPoint = true
          current.turningPointType = 'brilliant'
          current.turningPointDesc = `黑方妙手：局势提升了 +${Math.abs(delta).toFixed(0)}`
        } else if (delta >= 180) {
          current.isTurningPoint = true
          current.turningPointType = 'mistake'
          current.turningPointDesc = `黑方失误：局势恶化了 -${delta.toFixed(0)}`
        }
      }
    }

    // 3. Map to SVG Coordinates
    // ViewBox dimensions: 500 x 120
    const margin = { left: 20, right: 20, top: 15, bottom: 15 }
    const width = 500 - margin.left - margin.right
    const height = 120 - margin.top - margin.bottom
    const midY = margin.top + height / 2 // Y = 60

    const count = chartData.length
    
    return chartData.map((d, idx) => {
      // X coordinate mapping (equally spaced)
      const x = count <= 1 
        ? margin.left + width / 2
        : margin.left + (idx / (count - 1)) * width
      
      // Y coordinate mapping (clamped score mapped between -2000 and 2000)
      // Positive score (Red) goes up (lower Y), Negative (Black) goes down (higher Y)
      const y = midY - (d.clampedScore / 2000) * (height / 2)
      
      return {
        ...d,
        x,
        y
      } as ChartPoint
    })
  }, [session.moveHistory, session.initialPen])

  // Get current active ply from replay or live position
  const activePly = replay.isReplaying ? replay.currentPly : session.moveHistory.length

  // Find active score and advantage text for header display
  const currentActivePoint = points[Math.min(activePly, points.length - 1)]
  const activeScore = currentActivePoint?.score ?? 0
  const isRedAdvantage = activeScore > 0
  const advantageText = Math.abs(activeScore) < 50 
    ? '势均力敌' 
    : (isRedAdvantage ? `红方优势 +${Math.abs(activeScore).toFixed(0)}` : `黑方优势 +${Math.abs(activeScore).toFixed(0)}`)

  // Construct SVG Path
  const linePath = useMemo(() => {
    if (points.length === 0) return ''
    if (points.length === 1) {
      return `M 20 60 H 480` // Flat line
    }
    
    // Generate SVG path string
    return points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  }, [points])

  // Construct Fill Paths for Area Gradient below/above midline
  const fillPaths = useMemo(() => {
    if (points.length <= 1) return { redFill: '', blackFill: '' }

    const margin = { left: 20, right: 20, top: 15, bottom: 15 }
    const height = 120 - margin.top - margin.bottom
    const midY = margin.top + height / 2 // Y = 60

    // Top half (Red advantage, Y < 60)
    // Bottom half (Black advantage, Y > 60)
    let redPathSegments: string[] = []
    let blackPathSegments: string[] = []

    // To make a closed shape for filling, we need to trace the path and close it along Y = 60
    // Red Fill: clamp bottom to 60
    let redSegment = ''
    points.forEach((p, idx) => {
      const redY = Math.min(60, p.y) // Only above midY
      if (idx === 0) {
        redSegment += `M ${p.x.toFixed(1)} 60 L ${p.x.toFixed(1)} ${redY.toFixed(1)}`
      } else {
        redSegment += ` L ${p.x.toFixed(1)} ${redY.toFixed(1)}`
      }
    })
    redSegment += ` L ${points[points.length - 1].x.toFixed(1)} 60 Z`
    
    // Black Fill: clamp top to 60
    let blackSegment = ''
    points.forEach((p, idx) => {
      const blackY = Math.max(60, p.y) // Only below midY
      if (idx === 0) {
        blackSegment += `M ${p.x.toFixed(1)} 60 L ${p.x.toFixed(1)} ${blackY.toFixed(1)}`
      } else {
        blackSegment += ` L ${p.x.toFixed(1)} ${blackY.toFixed(1)}`
      }
    })
    blackSegment += ` L ${points[points.length - 1].x.toFixed(1)} 60 Z`

    return {
      redFill: redSegment,
      blackFill: blackSegment
    }
  }, [points])

  // Mouse scrubbing handler to select closest node
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (points.length === 0) return
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const svgX = (mouseX / rect.width) * 500 // Map back to 500px viewBox

    // Find the index of the closest point in xCoordinates
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

  // Clicking on a point triggers jumping to that ply in replay
  const handlePointClick = (idx: number) => {
    if (idx === activePly && replay.isReplaying) return
    
    if (!replay.isReplaying) {
      replay.enterReplay()
    }
    
    replay.goToPly(idx)
  }

  // Auto scroll/track selected point
  const activePoint = points[activePly]

  return (
    <div className="trend-chart-container" ref={containerRef}>
      {/* Header */}
      <div className="trend-chart-header">
        <div className="trend-chart-title-area">
          <span className="trend-title-text">📊 对局局势走势</span>
          <span className={`trend-advantage-pill ${activeScore === 0 ? 'equal' : (isRedAdvantage ? 'red-adv' : 'black-adv')}`}>
            {advantageText}
          </span>
          {replay.isReplaying && (
            <span className="trend-replay-indicator pulse-replay">
              👁️ 回放步: {replay.currentPly} / {replay.totalPlies}
            </span>
          )}
        </div>
        
        <div className="trend-header-actions">
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

      {/* SVG Canvas Wrapper */}
      <div className="trend-chart-canvas-wrapper" style={{ position: 'relative' }}>
        <svg 
          viewBox="0 0 500 120" 
          className="trend-chart-svg"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={() => hoveredIndex !== null && handlePointClick(hoveredIndex)}
          style={{ cursor: hoveredIndex !== null ? 'pointer' : 'default' }}
        >
          <defs>
            {/* Area Gradients */}
            <linearGradient id="red-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(239, 68, 68, 0.25)" />
              <stop offset="100%" stopColor="rgba(239, 68, 68, 0.0)" />
            </linearGradient>
            <linearGradient id="black-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(59, 130, 246, 0.0)" />
              <stop offset="100%" stopColor="rgba(59, 130, 246, 0.25)" />
            </linearGradient>

            {/* Line Glow Filter */}
            <filter id="glow-effect" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid lines */}
          <line x1="20" y1="15" x2="480" y2="15" stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
          <line x1="20" y1="37.5" x2="480" y2="37.5" stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
          <line x1="20" y1="82.5" x2="480" y2="82.5" stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
          <line x1="20" y1="105" x2="480" y2="105" stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />

          {/* Midline (Y = 0) */}
          <line 
            x1="20" 
            y1="60" 
            x2="480" 
            y2="60" 
            stroke="rgba(255, 255, 255, 0.2)" 
            strokeWidth="1.5"
            strokeDasharray={points.length <= 1 ? "none" : "4,4"}
          />

          {/* Fills under curve */}
          {points.length > 1 && (
            <>
              <path d={fillPaths.redFill} fill="url(#red-gradient)" />
              <path d={fillPaths.blackFill} fill="url(#black-gradient)" />
            </>
          )}

          {/* The Glowing Trend Line */}
          {points.length > 0 && (
            <path 
              d={linePath} 
              fill="none" 
              stroke="#60a5fa" 
              strokeWidth="2.5" 
              filter="url(#glow-effect)"
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
              stroke="rgba(96, 165, 250, 0.6)" 
              strokeWidth="1" 
              strokeDasharray="2,2" 
            />
          )}

          {/* Turning Points Indicators (👑/⚠️/⭐) */}
          {points.map((p, idx) => {
            if (!p.isTurningPoint) return null
            
            let color = '#f59e0b' // yellow for reversal
            if (p.turningPointType === 'brilliant') color = '#10b981' // green
            if (p.turningPointType === 'mistake') color = '#ef4444' // red
            
            return (
              <g key={`turning-point-${idx}`} className="trend-turning-group">
                <circle 
                  cx={p.x} 
                  cy={p.y} 
                  r="6" 
                  fill="none" 
                  stroke={color} 
                  strokeWidth="1.5"
                  className="trend-turning-ring" 
                />
                <circle 
                  cx={p.x} 
                  cy={p.y} 
                  r="3.5" 
                  fill={color} 
                  stroke="#0f172a"
                  strokeWidth="1"
                />
              </g>
            )
          })}

          {/* Highlight active step dot */}
          {activePoint && (
            <circle 
              cx={activePoint.x} 
              cy={activePoint.y} 
              r="6.5" 
              fill="none" 
              stroke="#ffffff" 
              strokeWidth="2" 
              filter="drop-shadow(0 0 3px rgba(255,255,255,0.8))"
            />
          )}

          {/* Hover Scrub vertical line & dot indicator */}
          {hoveredIndex !== null && points[hoveredIndex] && (
            <>
              <line 
                x1={points[hoveredIndex].x} 
                y1="10" 
                x2={points[hoveredIndex].x} 
                y2="110" 
                stroke="rgba(255, 255, 255, 0.4)" 
                strokeWidth="1.5" 
              />
              <circle 
                cx={points[hoveredIndex].x} 
                cy={points[hoveredIndex].y} 
                r="4.5" 
                fill="#ffffff" 
                stroke="#3b82f6" 
                strokeWidth="1.5"
              />
            </>
          )}
        </svg>

        {/* Dynamic Tooltip */}
        {hoveredIndex !== null && points[hoveredIndex] && (
          <div 
            className="trend-chart-tooltip"
            style={{
              position: 'absolute',
              left: `${(points[hoveredIndex].x / 500) * 100}%`,
              bottom: '105%',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              animation: 'tooltipFadeIn 0.15s ease-out forwards',
            }}
          >
            <div className="trend-tooltip-card">
              <div className="trend-tooltip-header">
                <span className="trend-tooltip-ply">第 {points[hoveredIndex].ply} 步</span>
                <span className="trend-tooltip-notation">
                  {points[hoveredIndex].ply === 0 ? '布局开始' : `${points[hoveredIndex].side === 'RED' ? '🔴 红方' : '⚫ 黑方'} : ${points[hoveredIndex].notation}`}
                </span>
              </div>
              <div className="trend-tooltip-body">
                <span className="trend-tooltip-score">
                  评分: <strong style={{ color: points[hoveredIndex].score > 0 ? '#4ade80' : points[hoveredIndex].score < 0 ? '#60a5fa' : '#ffffff' }}>
                    {points[hoveredIndex].score > 0 ? `+${points[hoveredIndex].score.toFixed(0)}` : points[hoveredIndex].score.toFixed(0)}
                  </strong>
                </span>
                {points[hoveredIndex].isTurningPoint && (
                  <div className="trend-tooltip-alert">
                    <span className={`trend-alert-badge ${points[hoveredIndex].turningPointType}`}>
                      {points[hoveredIndex].turningPointType === 'brilliant' ? '👑 妙手' : points[hoveredIndex].turningPointType === 'mistake' ? '⚠️ 失误' : '⭐ 逆转'}
                    </span>
                    <p className="trend-alert-desc">{points[hoveredIndex].turningPointDesc}</p>
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
        <div className="trend-chart-footer">
          <span>💡 提示：滑动鼠标可 scrub 浏览走势，点击任意数据点即可跳转回放该步局势。</span>
        </div>
      )}
    </div>
  )
}
