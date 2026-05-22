import { useEffect, useMemo, useState } from 'react'
import { evaluatePosition, scoreToPercentage } from '../utils/evaluation'
import { requestAiEvaluationFromServer } from '../llm/apiClient'
import { loadLlmSettings } from '../storage/llmSettingsStore'

interface EvaluationBarProps {
  pen: string
  playerSide?: 'RED' | 'BLACK'
  onShowExplanation?: () => void
}

export function EvaluationBar({ pen, onShowExplanation }: EvaluationBarProps) {
  const [score, setScore] = useState<number>(0)
  
  // Instantly compute local static score whenever PEN changes
  useEffect(() => {
    const localScore = evaluatePosition(pen)
    setScore(localScore)

    // Check if we should fetch from remote engine
    const settings = loadLlmSettings()
    if (settings.providerId === 'local-engine') {
      return // Already done!
    }

    // Delay the API call slightly to avoid spamming if scrubbing through replay
    const timerId = setTimeout(async () => {
      try {
        const remoteScore = await requestAiEvaluationFromServer(pen)
        if (remoteScore !== null) {
          setScore(remoteScore)
        }
      } catch (err) {
        console.error('Failed to fetch remote evaluation:', err)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timerId)
  }, [pen])

  const percentage = useMemo(() => scoreToPercentage(score), [score])

  // If score > 0, Red is better.
  const isRedAdvantage = score > 0
  const advantageText = Math.abs(score) < 50 ? '势均力敌' : (isRedAdvantage ? '红优' : '黑优')
  const scoreDisplay = Math.abs(score).toFixed(0)

  return (
    <div className="evaluation-bar-container" title={`局势评估分数: ${score > 0 ? '+' : ''}${scoreDisplay} (${advantageText})`}>
      <div className="evaluation-bar-track">
        <div 
          className="evaluation-bar-fill red-fill" 
          style={{ width: `${percentage}%` }}
        />
        <div 
          className="evaluation-bar-fill black-fill" 
          style={{ width: `${100 - percentage}%` }}
        />
        <div className="evaluation-bar-divider" />
      </div>
      <div className="evaluation-bar-labels">
        <span className="eval-label red-label">
          红方 {isRedAdvantage && <span className="eval-score">+{scoreDisplay}</span>}
        </span>
        <span className="eval-label black-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isRedAdvantage && score !== 0 && <span className="eval-score">+{scoreDisplay}</span>} 黑方
          {onShowExplanation && (
            <button 
              className="eval-info-btn" 
              onClick={onShowExplanation}
              title="查看局势评估算法说明"
              aria-label="查看局势评估算法说明"
              style={{
                background: 'none', border: 'none', color: 'inherit', 
                cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center',
                opacity: 0.7
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </button>
          )}
        </span>
      </div>
    </div>
  )
}
