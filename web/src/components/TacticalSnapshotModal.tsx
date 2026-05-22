import { useEffect, useRef, useState } from 'react'
import ZhChess from 'zh-chess'
import type { TacticalSnapshot } from '../types/gameSession'

interface TacticalSnapshotModalProps {
  snapshot: TacticalSnapshot
  onClose: () => void
  onStartPractice: (snapshot: TacticalSnapshot) => void
}

export function TacticalSnapshotModal({ snapshot, onClose, onStartPractice }: TacticalSnapshotModalProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(-1) // -1 means starting board before any steps in snapshot
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const gameRef = useRef<ZhChess | null>(null)

  const stepsCount = snapshot.steps.length

  // Initialize ZhChess mini-board once
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const game = new ZhChess({
      ctx,
      gameWidth: 360,
      gameHeight: 360,
      gamePadding: 16,
      checkerboardBackground: '#e8c890',
      redPeiceBackground: '#fff8e8',
      blackPeiceBackground: '#f5ecd8',
      redPeiceTextColor: '#b91c1c',
      blackPeiceTextColor: '#1c1917',
      choosePeiceBorderColor: '#d97706',
      movePointColor: '#15803d',
      boardTextColor: '#44403c',
    })
    gameRef.current = game
    game.changePlaySide(snapshot.playerSide)
  }, [snapshot.playerSide])

  // Redraw when current step or snapshot FEN updates
  useEffect(() => {
    const game = gameRef.current
    const canvas = canvasRef.current
    if (!game || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pen = currentStepIndex === -1 ? snapshot.startPen : snapshot.steps[currentStepIndex].penCode
    game.setPenCodeList(pen)
    game.draw(ctx)
  }, [currentStepIndex, snapshot.startPen, snapshot.steps])

  // Step navigation helpers
  const goToStart = () => setCurrentStepIndex(-1)
  const goToEnd = () => setCurrentStepIndex(stepsCount - 1)
  const stepBackward = () => setCurrentStepIndex((prev) => Math.max(-1, prev - 1))
  const stepForward = () => setCurrentStepIndex((prev) => Math.min(stepsCount - 1, prev + 1))

  const activeStep = currentStepIndex >= 0 ? snapshot.steps[currentStepIndex] : null

  return (
    <div
      className="dialog-backdrop"
      style={{
        backdropFilter: 'blur(12px)',
        backgroundColor: 'rgba(15, 12, 10, 0.8)',
        animation: 'fadeIn 0.3s ease-out',
      }}
      onClick={onClose}
    >
      <div
        className="dialog"
        style={{
          width: 'min(500px, 95vw)',
          padding: '1.5rem',
          borderRadius: '16px',
          background: 'rgba(37, 32, 25, 0.95)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(245, 158, 11, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem',
          color: 'var(--text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: '600',
                padding: '0.25rem 0.6rem',
                borderRadius: '6px',
                backgroundColor: snapshot.type === 'positive' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: snapshot.type === 'positive' ? '#4ade80' : '#f87171',
                border: `1px solid ${snapshot.type === 'positive' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              }}
            >
              {snapshot.type === 'positive' ? '🟢 优势瞬间' : '🔴 失误瞬间'}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {new Date(snapshot.timestamp).toLocaleString()}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.5rem',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '0 0.5rem',
            }}
          >
            &times;
          </button>
        </div>

        {/* Reason */}
        <div style={{ width: '100%', textAlign: 'left' }}>
          <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            触发原因
          </h4>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', color: 'var(--text)' }}>
            {snapshot.triggerReason}
          </p>
        </div>

        {/* Board Canvas Wrapper */}
        <div
          style={{
            position: 'relative',
            width: '360px',
            height: '360px',
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: '#e8c890',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
            lineHeight: 0,
          }}
        >
          <canvas
            ref={canvasRef}
            width={360}
            height={360}
            style={{ display: 'block' }}
          />
        </div>

        {/* Playback Controls */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={goToStart}
              disabled={currentStepIndex === -1}
              style={{ fontSize: '0.8rem', opacity: currentStepIndex === -1 ? 0.4 : 1 }}
              title="回到开始"
            >
              ⏮
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={stepBackward}
              disabled={currentStepIndex === -1}
              style={{ fontSize: '0.8rem', opacity: currentStepIndex === -1 ? 0.4 : 1 }}
              title="上一步"
            >
              ⏪
            </button>

            <span
              style={{
                fontSize: '0.9rem',
                fontWeight: '600',
                minWidth: '150px',
                textAlign: 'center',
                color: 'var(--text)',
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--border)',
              }}
            >
              {currentStepIndex === -1 ? (
                '🏁 开始局面'
              ) : (
                `第 ${currentStepIndex + 1} / ${stepsCount} 步: ${activeStep?.notation || ''} (${activeStep?.side === 'RED' ? '红' : '黑'})`
              )}
            </span>

            <button
              type="button"
              className="btn btn-sm"
              onClick={stepForward}
              disabled={currentStepIndex === stepsCount - 1}
              style={{ fontSize: '0.8rem', opacity: currentStepIndex === stepsCount - 1 ? 0.4 : 1 }}
              title="下一步"
            >
              ⏩
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={goToEnd}
              disabled={currentStepIndex === stepsCount - 1}
              style={{ fontSize: '0.8rem', opacity: currentStepIndex === stepsCount - 1 ? 0.4 : 1 }}
              title="跳到最后"
            >
              ⏭
            </button>
          </div>
        </div>

        {/* Coaching Hint Callout */}
        {snapshot.coachingHint ? (
          <div
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              textAlign: 'left',
              animation: 'slideUp 0.3s ease-out',
            }}
          >
            <h5 style={{ margin: '0 0 0.35rem', color: 'var(--accent)', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              💡 AI 战术点评与指导
            </h5>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text)', lineHeight: '1.45' }}>
              {snapshot.coachingHint}
            </p>
          </div>
        ) : (
          <div
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
              textAlign: 'left',
            }}
          >
            <h5 style={{ margin: '0 0 0.25rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '600' }}>
              💡 AI 指导状态
            </h5>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              暂无点评建议。你可以点击“一键导出分析提示词”并发给大模型，获取深度战术分析后在此导入！
            </p>
          </div>
        )}

        {/* Modal Actions */}
        <div style={{ width: '100%', display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            className="btn primary"
            style={{
              flex: 1,
              padding: '0.75rem',
              fontSize: '1rem',
              fontWeight: '600',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(185, 28, 28, 0.3)',
            }}
            onClick={() => {
              onStartPractice(snapshot)
              onClose()
            }}
          >
            🎯 重新练习本局
          </button>
          <button
            type="button"
            className="btn"
            style={{
              padding: '0.75rem 1.25rem',
              fontSize: '1rem',
              fontWeight: '500',
              borderRadius: '10px',
            }}
            onClick={onClose}
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
