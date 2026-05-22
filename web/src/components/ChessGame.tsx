import { useChessGame } from '../hooks/useChessGame'
import { useReplay } from '../hooks/useReplay'
import { getAiSide } from '../utils/chessSides'
import { peiceSideMap, type PieceSide } from 'zh-chess'
import { LlmSettings } from './LlmSettings'
import { SessionList } from './SessionList'
import { ReplayControls } from './ReplayControls'
import { CapturedPieces } from './CapturedPieces'
import buildInfo from '../build-info.json'
import { useState, useEffect } from 'react'
import type { TacticalSnapshot } from '../types/gameSession'
import { loadSnapshots, updateSnapshotCoaching, clearSnapshots, deleteSnapshot } from '../storage/snapshotStore'
import { TacticalSnapshotModal } from './TacticalSnapshotModal'
import { EvaluationBar } from './EvaluationBar'

const SIDE_OPTIONS: { value: PieceSide; label: string }[] = [
  { value: 'RED', label: '红方（先手）' },
  { value: 'BLACK', label: '黑方' },
]

export function ChessGame({ 
  onShowChangelog, 
  onShowExplanation 
}: { 
  onShowChangelog: () => void; 
  onShowExplanation: () => void; 
}) {
  const {
    canvasRef,
    gameRef,
    sessions,
    activeSession,
    activeSessionId,
    playerSide,
    setPlayerSide,
    vsAi,
    setVsAi,
    currentTurn,
    moveHistory,
    winner,
    statusMessage,
    aiThinking,
    lastAiPrompt,
    lastAiResponse,
    keyPieceAlert,
    startNewGame,
    triggerAiMove,
    undoMove,
    clearKeyPieceAlert,
    flipBoard,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
    patchActiveSession,
    startSnapshotPractice,
    exitSnapshotPractice,
    pendingSnapshot,
    confirmPendingSnapshot,
    cancelPendingSnapshot,
    boardSize,
  } = useChessGame()

  const [showSettings, setShowSettings] = useState(false)
  const [snapshots, setSnapshots] = useState<TacticalSnapshot[]>(loadSnapshots())
  const [activeModalSnapshot, setActiveModalSnapshot] = useState<TacticalSnapshot | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importText, setImportText] = useState('')
  const [activeToast, setActiveToast] = useState<{ id: string; type: 'positive' | 'negative'; message: string; subtext: string; isFadingOut: boolean } | null>(null)
  const [isToastHovered, setIsToastHovered] = useState(false)
  const [boardGlow, setBoardGlow] = useState<'positive' | 'negative' | null>(null)
  const [sidebarFlash, setSidebarFlash] = useState(false)

  // Handle auto-dismiss and fade-out timer
  useEffect(() => {
    if (!activeToast || isToastHovered) return
    
    const fadeTimer = setTimeout(() => {
      setActiveToast(prev => prev ? { ...prev, isFadingOut: true } : null)
    }, 4500)

    const removeTimer = setTimeout(() => {
      setActiveToast(null)
    }, 4850)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [activeToast, isToastHovered])

  // Auto-dismiss key piece regret warning after 5 seconds
  useEffect(() => {
    if (keyPieceAlert) {
      const timer = setTimeout(() => {
        clearKeyPieceAlert()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [keyPieceAlert, clearKeyPieceAlert])

  // Auto-dismiss pending snapshot proposal after 5 seconds
  useEffect(() => {
    if (pendingSnapshot) {
      const timer = setTimeout(() => {
        cancelPendingSnapshot()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [pendingSnapshot, cancelPendingSnapshot])

  const closeToast = () => {
    if (!activeToast) return
    setActiveToast(prev => prev ? { ...prev, isFadingOut: true } : null)
    setTimeout(() => {
      setActiveToast(null)
    }, 350)
  }

  useEffect(() => {
    const handleSnapshotsChanged = (e: Event) => {
      const snapList = loadSnapshots()
      setSnapshots(snapList)

      const customEvent = e as CustomEvent<{ snapshot?: TacticalSnapshot }>
      if (customEvent.detail?.snapshot) {
        const snap = customEvent.detail.snapshot
        console.log('[象棋·错题本] 收到新战术瞬间事件:', snap)
        
        // Trigger Toast Alert
        setActiveToast({
          id: snap.id,
          type: snap.type,
          message: snap.triggerReason,
          subtext: `已自动录入战术错题本 (${snapList.length}/30)`,
          isFadingOut: false
        })

        // Trigger Chessboard Neon Glow Ripple
        setBoardGlow(snap.type)
        setTimeout(() => setBoardGlow(null), 2500)

        // Trigger Sidebar Highlight Flash
        setSidebarFlash(true)
        setTimeout(() => setSidebarFlash(false), 2500)
      } else {
        console.log('[象棋·错题本] 收到 snapshots-changed 事件，未携带 payload')
      }
    }
    window.addEventListener('chess-snapshots-changed', handleSnapshotsChanged)
    return () => {
      window.removeEventListener('chess-snapshots-changed', handleSnapshotsChanged)
    }
  }, [])

  const handleExportPrompt = () => {
    if (snapshots.length === 0) {
      alert('错题本中暂无战术瞬间可以导出。快去和 AI 对弈吧，吃子或局势大幅波动都会被自动记录！')
      return
    }

    let markdown = `# 👑 中国象棋特级大师教练战术复盘请求

您好！我是一名正在精进棋艺的象棋爱好者。在我的对弈中，系统自动抓取了以下关键的“分水岭瞬间（战术错题）”。

每个战术瞬间都包含了触发事件以及该瞬间发生前及当时的十步完整记谱（5个回合）和局面 PEN 状态。

请您扮演我的特级大师教练，为我逐一分析这些瞬间：
1. **得失诊断**：简要分析我在这个瞬间犯了什么错误（若是失误），或抓住了什么战术机会（若是优势）。
2. **战术要点**：在此局面下，我应该注意什么？正确的行棋方向和思路是什么？
3. **行动指南**：请给出一句简明扼要的战术提示（1-2句话，不超过60字），帮助我在“重新练习本局”时能够获得灵感。

---

## ⚠️ 极其重要：格式要求 ⚠️
为了方便我的象棋系统能够自动解析并一键载入您的大师提示，请您在给出的专业文字复盘后，**必须在回答的最末尾附带一个标准的 JSON 代码块**。JSON 的格式和结构必须如下：

\`\`\`json
{
  "snapshots": [
`

    snapshots.forEach((s, idx) => {
      markdown += `    {\n`
      markdown += `      "id": "${s.id}",\n`
      markdown += `      "hint": "大师指导意见：(在此处填入您对本瞬间的1-2句精炼实战指导意见)"\n`
      markdown += `    }${idx === snapshots.length - 1 ? '' : ','}\n`
    })

    markdown += `  ]
}
\`\`\`

---

## 待分析的战术瞬间列表：\n\n`

    snapshots.forEach((s, idx) => {
      markdown += `### 瞬间 #${idx + 1}：[${s.type === 'positive' ? '🟢 优势瞬间' : '🔴 失误瞬间'}] ${s.triggerReason}\n`
      markdown += `- **对局标题**: ${s.gameTitle}\n`
      markdown += `- **瞬间 ID**: \`${s.id}\` (请务必在 JSON 中原样保留该 ID)\n`
      markdown += `- **对局阵营**: 我执${s.playerSide === 'RED' ? '红方（先手）' : '黑方'}\n`
      markdown += `- **触发步骤**: 第 ${s.triggerMoveIndex + 1} 步\n`
      markdown += `- **战术轨迹（前10步）**:\n`
      s.steps.forEach((step) => {
        markdown += `  - 相对第 ${step.ply + 1} 步 [${step.side === 'RED' ? '红方' : '黑方'}]: \`${step.notation}\`${step.evaluation !== undefined ? ` (局势评估: ${step.evaluation})` : ''}\n`
      })
      markdown += `\n---\n\n`
    })

    navigator.clipboard.writeText(markdown)
      .then(() => {
        alert('🎉 象棋大师复盘提示词已复制到剪贴板！\n\n可以直接发送给大模型（如 ChatGPT, Claude, Gemini），获得点评后复制大模型返回的 JSON 代码块，在“战术错题本”中点击“导入 AI 点评”即可！')
      })
      .catch((err) => {
        console.error('复制失败', err)
        alert('复制提示词失败，请在控制台查看或重试。')
      })
  }

  const handleImportCoaching = () => {
    try {
      let cleanedText = importText.trim()
      const jsonRegex = /\{[\s\S]*\}/
      const match = cleanedText.match(jsonRegex)
      if (match) {
        cleanedText = match[0]
      }

      const parsed = JSON.parse(cleanedText)
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('解析出来的内容不是有效的 JSON 对象')
      }

      if (!parsed.snapshots || !Array.isArray(parsed.snapshots)) {
        throw new Error('JSON 格式错误：必须包含 "snapshots" 数组')
      }

      const updated = updateSnapshotCoaching(parsed)
      setSnapshots(updated)
      setShowImportDialog(false)
      setImportText('')
      
      window.dispatchEvent(new CustomEvent('chess-snapshots-changed'))
      alert(`🎉 成功导入点评！大师指导意见已同步到对应的战术瞬间中。`)
    } catch (err) {
      console.error('[导入 AI 点评] 失败', err)
      alert(`❌ 导入失败。\n原因：${err instanceof Error ? err.message : 'JSON 语法错误'}`)
    }
  }

  const handleDeleteSingleSnapshot = (id: string) => {
    if (window.confirm('您确定要从“战术错题本”中删除这个瞬间吗？此操作不可恢复。')) {
      const updated = deleteSnapshot(id)
      setSnapshots(updated)
      window.dispatchEvent(new CustomEvent('chess-snapshots-changed'))
    }
  }

  const replay = useReplay(activeSession, gameRef, canvasRef)

  const canChangeSide = activeSession.status === 'setup' || !!winner
  const startLabel =
    activeSession.status === 'setup' ? '开始对局' : '重开对局'
  const aiSide = getAiSide(playerSide)
  const isAiTurn =
    vsAi &&
    activeSession.status === 'active' &&
    !winner &&
    currentTurn !== playerSide
  
  const boardBlocked =
    replay.isReplaying ||
    (vsAi &&
      activeSession.status === 'active' &&
      !winner &&
      (aiThinking || (currentTurn != null && currentTurn !== playerSide)))

  const gameMode = vsAi ? '人机对弈' : '人人对弈'

  return (
    <div className="app">
      {activeToast && (
        <div 
          className={`tactical-toast ${activeToast.type} ${activeToast.isFadingOut ? 'fade-out' : ''}`}
          onMouseEnter={() => setIsToastHovered(true)}
          onMouseLeave={() => setIsToastHovered(false)}
        >
          <div className={`toast-badge ${activeToast.type}`}>
            {activeToast.type === 'positive' ? '妙' : '殆'}
          </div>
          <div className="toast-content">
            <h4 className="toast-title">{activeToast.message}</h4>
            <p className="toast-desc">{activeToast.subtext}</p>
          </div>
          <button type="button" className="toast-close" onClick={closeToast} aria-label="关闭提示">
            &times;
          </button>
          <div className={`toast-progress-bar ${activeToast.type}`} />
        </div>
      )}
      <header className="header">
        <div className="brand" data-tour="brand">
          <span className="brand-mark" aria-hidden>
            棋
          </span>
          <div>
            <h1>中国象棋</h1>
            <p className="tagline">人机对弈 · AI 教练</p>
          </div>
        </div>
        <div className="header-actions">
          <nav className="header-nav">
            <a 
              href="https://github.com/yuchenzhang/chinese-chess" 
              target="_blank" 
              rel="noopener noreferrer"
              className="nav-link"
              title="GitHub 仓库"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
            <button 
              type="button" 
              className="btn-link" 
              onClick={onShowExplanation}
              style={{ color: 'var(--accent)', fontWeight: 'bold' }}
            >
              💡 算法解析
            </button>
            <span style={{ color: 'var(--border)', margin: '0 4px' }}>|</span>
            <button 
              type="button" 
              className="btn-link" 
              onClick={onShowChangelog}
            >
              更新日志
            </button>
          </nav>
          <button 
            type="button" 
            className="btn btn-sm btn-tour" 
            onClick={() => window.dispatchEvent(new CustomEvent('start-tour'))}
          >
            ✨ 操作演示
          </button>
          <span className="phase-badge">{gameMode}</span>
        </div>
      </header>

      <main className="layout">
        <section className="board-panel" aria-label="棋盘">
          <div className="board-area">
            {activeSession.isCoaching && (
              <div 
                className="practice-banner" 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.2) 0%, rgba(37, 32, 25, 0.9) 100%)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  padding: '12px 20px',
                  borderRadius: '12px',
                  border: '1px solid rgba(217, 119, 6, 0.4)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 16px rgba(217, 119, 6, 0.1)',
                  marginBottom: '16px',
                  color: 'var(--text)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}>
                  <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>🎯</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#f59e0b', fontWeight: 'bold' }}>
                      战术沙盒练习中
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      局势由历史关键战术瞬间恢复。请找出最佳走法！
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={exitSnapshotPractice}
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    fontWeight: 'bold',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.35)'
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.6)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)'
                  }}
                >
                  🔙 退出练习
                </button>
              </div>
            )}
            
            <EvaluationBar 
              pen={replay.isReplaying 
                ? (replay.currentPly === 0 ? (activeSession.initialPen ?? 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR') : moveHistory[replay.currentPly - 1].penCode)
                : activeSession.positionPen
              }
              playerSide={playerSide}
              onShowExplanation={onShowExplanation}
            />

            <div className={`board-frame ${boardGlow === 'positive' ? 'glow-positive' : boardGlow === 'negative' ? 'glow-negative' : ''}`} data-tour="board">
              <canvas
                ref={canvasRef}
                width={boardSize}
                height={boardSize}
                className="board-canvas"
                role="img"
                aria-label="中国象棋棋盘，点击棋子走棋"
              />
              {boardBlocked && (
                <div className="board-blocker" aria-hidden="true">
                  {aiThinking && !replay.isReplaying && (
                    <span className="board-blocker-text">思考中…</span>
                  )}
                  {replay.isReplaying && (
                    <span className="board-blocker-text">回放中</span>
                  )}
                </div>
              )}
              
              {keyPieceAlert && !replay.isReplaying && (
                <div className="soft-bubble slide-up glow-red" role="status">
                  <span className="soft-bubble-text">
                    ⚠️ 你的<strong>{keyPieceAlert.pieceName}</strong>被吃，需要悔棋吗？
                  </span>
                  <div className="soft-bubble-actions">
                    <button 
                      type="button"
                      className="btn-soft-action danger" 
                      onClick={undoMove}
                    >
                      悔棋
                    </button>
                    <button 
                      type="button"
                      className="btn-soft-action secondary" 
                      onClick={clearKeyPieceAlert}
                    >
                      继续
                    </button>
                  </div>
                </div>
              )}

              {pendingSnapshot && !replay.isReplaying && (
                <div className={`soft-bubble slide-down ${pendingSnapshot.type === 'positive' ? 'glow-green' : 'glow-amber'}`} role="status">
                  <span className="soft-bubble-text">
                    {pendingSnapshot.type === 'positive' ? '👑' : '⚠️'} 检测到对局分水岭！录入战术本？
                  </span>
                  <div className="soft-bubble-actions">
                    <button 
                      type="button"
                      className="btn-soft-action primary" 
                      onClick={confirmPendingSnapshot}
                    >
                      录入
                    </button>
                    <button 
                      type="button"
                      className="btn-soft-action secondary" 
                      onClick={cancelPendingSnapshot}
                    >
                      忽略
                    </button>
                  </div>
                </div>
              )}

              {activeSession.status === 'active' && activeSession.coachingInstruction && !replay.isReplaying && (
                <div className="coaching-overlay" style={{
                  position: 'absolute',
                  top: '15%',
                  left: '10%',
                  right: '10%',
                  background: 'rgba(255, 255, 255, 0.98)',
                  backdropFilter: 'blur(8px)',
                  padding: '24px',
                  borderRadius: '16px',
                  boxShadow: '0 12px 48px rgba(0,0,0,0.3)',
                  border: '2px solid var(--accent)',
                  zIndex: 100,
                  color: '#1a1a1a',
                  lineHeight: 1.6
                }}>
                  <h3 style={{ marginTop: 0, marginBottom: '12px', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>💡</span> AI 教练指导
                  </h3>
                  <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 500, color: '#333' }}>{activeSession.coachingInstruction}</p>
                  <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                     <button 
                       className="btn primary" 
                       style={{ padding: '8px 24px', borderRadius: '20px' }}
                       onClick={() => patchActiveSession({ coachingInstruction: undefined })}
                     >
                       开始练习
                     </button>
                  </div>
                </div>
              )}

              {winner && !replay.isReplaying && (
                <div className="game-over-overlay">
                  <div className="game-over-card">
                    <div className={`game-over-icon ${vsAi && winner === playerSide ? 'victory' : vsAi && winner !== playerSide ? 'defeat' : ''}`}>
                      {vsAi
                        ? (winner === playerSide ? '🎉' : '😔')
                        : (winner === 'RED' ? '🏆' : '🏆')
                      }
                    </div>
                    <h2 className="game-over-title">
                      {vsAi
                        ? (winner === playerSide ? '恭喜你，胜利了！' : '很遗憾，你输了')
                        : `${peiceSideMap[winner]}方获胜！`
                      }
                    </h2>
                    <p className="game-over-subtitle">
                      {vsAi
                        ? (winner === playerSide
                          ? `你执${peiceSideMap[playerSide]}击败了 AI，共走了 ${moveHistory.length} 步`
                          : `AI 执${peiceSideMap[winner]}获胜，共走了 ${moveHistory.length} 步`)
                        : `${peiceSideMap[winner]}方在 ${moveHistory.length} 步后赢得了比赛`
                      }
                    </p>
                    <div className="game-over-actions">
                      <button
                        type="button"
                        className="btn-game-over primary"
                        onClick={startNewGame}
                      >
                        🔄 再来一局
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mobile-main-actions">
              <button
                type="button"
                className="btn primary btn-lg"
                onClick={startNewGame}
                disabled={aiThinking}
              >
                {startLabel}
              </button>
              
              <div className="mobile-secondary-row">
                <button 
                  type="button" 
                  className="btn btn-lg" 
                  onClick={() => setShowSettings(!showSettings)}
                  data-tour="mobile-settings-btn"
                >
                  {showSettings ? '隐藏设置' : '游戏设置'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-lg" 
                  onClick={undoMove}
                  disabled={moveHistory.length === 0 || aiThinking || !!winner}
                >
                  悔棋
                </button>
              </div>
            </div>

            <CapturedPieces
              moveHistory={moveHistory}
              maxPly={replay.isReplaying ? replay.currentPly : undefined}
            />
          </div>
        </section>

        <aside className={`sidebar ${showSettings ? 'show-mobile' : ''}`}>
          <div data-tour="session-list">
            <SessionList
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelect={(id) => { switchSession(id); setShowSettings(false); }}
              onCreate={createSession}
              onDelete={deleteSession}
              onRename={renameSession}
            />
          </div>

          <section className="card" data-tour="game-controls">
            <div className="card-header-with-toggle">
              <h2>对局设置</h2>
            </div>
            <div className="status-row">
              <p className={`status${statusMessage.includes('失败') || statusMessage.includes('未找到') ? ' status-error' : ''}`}>
                {statusMessage}
              </p>
              {lastAiResponse && (
                <div className="debug-tooltip-container">
                  <button 
                    type="button" 
                    className="btn-debug-icon"
                    title="查看引擎原始响应"
                    aria-label="查看调试信息"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="16" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                  </button>
                  <div className="debug-tooltip">
                    <div className="debug-tooltip-header">引擎原始响应</div>
                    <pre className="debug-tooltip-content">{lastAiResponse}</pre>
                  </div>
                </div>
              )}
            </div>
            
            <div className="game-info-summary">
              {activeSession.status === 'active' && !winner && (
                <p className="turn matchup">
                  {vsAi ? (
                    <>你执 <strong>{peiceSideMap[playerSide]}</strong>{' · '}AI 执 <strong>{peiceSideMap[aiSide]}</strong></>
                  ) : (
                    <>模式：<strong>人人对弈</strong></>
                  )}
                </p>
              )}
              {currentTurn && !winner && (
                <p className="turn">
                  当前行棋：
                  <strong>
                    {vsAi
                      ? (currentTurn === playerSide
                        ? `${peiceSideMap[currentTurn]}（你）`
                        : `${peiceSideMap[currentTurn]}（AI）`)
                      : peiceSideMap[currentTurn]
                    }
                  </strong>
                </p>
              )}
              {winner && (
                <p className="winner">
                  胜方：
                  <strong>
                    {vsAi
                      ? (winner === playerSide
                        ? `${peiceSideMap[winner]}（你）`
                        : `${peiceSideMap[winner]}（AI）`)
                      : peiceSideMap[winner]
                    }
                  </strong>
                </p>
              )}
            </div>

            <div className="settings-grid">
              <label className="field field-checkbox">
                <input
                  type="checkbox"
                  checked={vsAi}
                  onChange={(e) => setVsAi(e.target.checked)}
                  disabled={activeSession.status === 'active' && !winner}
                />
                <span>开启 AI 对弈</span>
              </label>

              {vsAi && (
                <label className="field">
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span>AI 难度</span>
                    <button
                      type="button"
                      className="btn-link"
                      onClick={onShowExplanation}
                      style={{ fontSize: '0.8rem', padding: 0, textDecoration: 'underline', color: 'var(--accent)', cursor: 'pointer', height: 'auto', background: 'none', border: 'none' }}
                      title="点击查看引擎是如何根据不同深度进行计算决策的"
                    >
                      (如何决策？)
                    </button>
                  </span>
                  <select
                    value={activeSession.engineDepth ?? 4}
                    onChange={(e) => patchActiveSession({ engineDepth: Number(e.target.value) })}
                    disabled={activeSession.status === 'active' && !winner}
                  >
                    <option value={2}>入门 (2层)</option>
                    <option value={3}>普通 (3层)</option>
                    <option value={4}>困难 (4层)</option>
                    <option value={5}>👑 大师 (5层 - 需远程计算)</option>
                    <option value={6}>🏆 宗师 (6层 - 需远程计算)</option>
                    <option value={7}>🌌 国手 (7层 - 需远程计算)</option>
                  </select>
                  {activeSession.engineDepth > 4 && (
                    <span className="field-hint" style={{ color: 'var(--accent)', marginTop: '4px', display: 'block', lineHeight: '1.4' }}>
                      ⚠️ 5层及以上搜索运算开销极大。为保证流畅对弈，请在下方配置并启用**远程引擎**并行计算。
                    </span>
                  )}
                </label>
              )}

              <label className="field">
                <span>你的阵营</span>
                <select
                  value={playerSide}
                  onChange={(e) => setPlayerSide(e.target.value as PieceSide)}
                  disabled={!canChangeSide}
                >
                  {SIDE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="actions desktop-only">
              <button
                type="button"
                className="btn primary"
                onClick={startNewGame}
                disabled={aiThinking}
              >
                {startLabel}
              </button>
              {isAiTurn && !aiThinking && (
                <button
                  type="button"
                  className="btn primary"
                  onClick={triggerAiMove}
                >
                  请求 AI 走子
                </button>
              )}
              <button 
                type="button" 
                className="btn" 
                onClick={undoMove}
                disabled={moveHistory.length === 0 || aiThinking || !!winner}
              >
                悔棋
              </button>
              <button type="button" className="btn" onClick={flipBoard}>
                翻转视角
              </button>
            </div>
            
            <div className="actions mobile-only" style={{ marginTop: '1rem' }}>
               <button type="button" className="btn" onClick={flipBoard} style={{ flex: 1 }}>
                翻转视角
              </button>
              {isAiTurn && !aiThinking && (
                <button
                  type="button"
                  className="btn primary"
                  onClick={triggerAiMove}
                  style={{ flex: 1 }}
                >
                  请求 AI 走子
                </button>
              )}
            </div>
          </section>

          <section className="card" data-tour="move-history">
            <h2>走子记录</h2>
            <ReplayControls 
              replay={replay} 
            />
            {moveHistory.length === 0 ? (
              <p className="muted">开局后每步记谱将显示于此</p>
            ) : (
              <ol className="move-list">
                {moveHistory.map((m, i) => (
                  <li
                    key={`${i}-${m.penCode}`}
                    className={`${replay.isReplaying && i + 1 === replay.currentPly ? 'move-active' : ''}${m.captured ? ' move-capture' : ''}${m.isNotable ? ' move-notable' : ''}`}
                    onClick={() => {
                      if (replay.isReplaying) {
                        replay.goToPly(i + 1)
                      }
                    }}
                    style={replay.isReplaying ? { cursor: 'pointer' } : undefined}
                  >
                    <span className="move-no">{i + 1}.</span>
                    <span className="move-side">
                      {vsAi
                        ? (m.side === playerSide ? '你' : 'AI')
                        : peiceSideMap[m.side]
                      }
                    </span>
                    <span className="move-notation">{m.notation}</span>
                    {m.captured && (
                      <span className="capture-tag" title={`吃${m.captured.displayName}`}>
                        ×{m.captured.displayName}
                      </span>
                    )}
                    {m.inCheck && <span className="check-tag">将</span>}
                    {m.isNotable && (
                      <span className="notable-tag" title={m.notableReason}>
                        ★{m.notableReason && <span className="notable-reason">{m.notableReason}</span>}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className={`card ${sidebarFlash ? 'sidebar-flash' : ''}`} data-tour="tactical-snapshots" style={{ marginTop: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>战术错题本 <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>({snapshots.length}/30)</span></h2>
              {snapshots.length > 0 && (
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => {
                    if (window.confirm('您确定要清空所有的战术瞬间吗？这不可恢复。')) {
                      const updated = clearSnapshots()
                      setSnapshots(updated)
                      window.dispatchEvent(new CustomEvent('chess-snapshots-changed'))
                    }
                  }}
                  style={{ fontSize: '0.8rem', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  清空
                </button>
              )}
            </div>

            {snapshots.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem', opacity: 0.5 }}>📚</span>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>暂无记录的关键战术瞬间。</p>
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', opacity: 0.7 }}>在对弈中吃掉对方大子，或局面得分发生剧烈变化时将自动捕获！</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-sm primary"
                    onClick={handleExportPrompt}
                    style={{ flex: 1, fontSize: '0.8rem', padding: '6px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}
                  >
                    <span>📤</span> 导出分析提示词
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setShowImportDialog(true)}
                    style={{ flex: 1, fontSize: '0.8rem', padding: '6px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}
                  >
                    <span>📥</span> 导入 AI 点评
                  </button>
                </div>

                <div 
                  className="snapshot-list" 
                  style={{ 
                    maxHeight: '280px', 
                    overflowY: 'auto', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '0.5rem',
                    paddingRight: '4px'
                  }}
                >
                  {snapshots.map((s) => {
                    const isPositive = s.type === 'positive'
                    return (
                      <div
                        key={s.id}
                        className="snapshot-item"
                        onClick={() => setActiveModalSnapshot(s)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--surface)',
                          border: `1px solid ${s.coachingHint ? 'rgba(245, 158, 11, 0.25)' : 'var(--border)'}`,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          boxShadow: s.coachingHint ? '0 2px 8px rgba(245, 158, 11, 0.05)' : 'none',
                          textAlign: 'left',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px)'
                          e.currentTarget.style.borderColor = isPositive ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.borderColor = s.coachingHint ? 'rgba(245, 158, 11, 0.25)' : 'var(--border)'
                          e.currentTarget.style.backgroundColor = 'var(--surface)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                          <span
                            style={{
                              flexShrink: 0,
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: isPositive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: isPositive ? '#4ade80' : '#f87171',
                              fontSize: '0.8rem',
                              fontWeight: 'bold',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: `1px solid ${isPositive ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                            }}
                          >
                            {isPositive ? '妙' : '殆'}
                          </span>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text)' }}>
                              {s.triggerReason}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {s.gameTitle} · {new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          {s.coachingHint && (
                            <span 
                              style={{ 
                                fontSize: '0.7rem', 
                                backgroundColor: 'rgba(245, 158, 11, 0.15)', 
                                color: '#fbbf24', 
                                padding: '2px 6px', 
                                borderRadius: '12px', 
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                fontWeight: '600',
                              }}
                              title="已获得大模型教练点评"
                            >
                              💡 点评
                            </span>
                          )}
                          <button
                            type="button"
                            className="btn-delete-snapshot"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSingleSnapshot(s.id);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'rgba(255, 255, 255, 0.3)',
                              fontSize: '1.2rem',
                              fontWeight: 'normal',
                              cursor: 'pointer',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              lineHeight: 1,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#ef4444';
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.3)';
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            title="删除此瞬间"
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>

          {vsAi && (activeSession.engineDepth ?? 4) > 4 && (
            <LlmSettings onShowExplanation={onShowExplanation} />
          )}

          {lastAiResponse && (
            <details className="card card-muted">
              <summary style={{ cursor: 'pointer' }}><h2 style={{ display: 'inline', margin: 0 }}>引擎分析</h2></summary>
              <pre className="pen-block">{lastAiResponse}</pre>
            </details>
          )}

          {lastAiPrompt && (
            <details className="card card-muted">
              <summary style={{ cursor: 'pointer' }}><h2 style={{ display: 'inline', margin: 0 }}>引擎调试信息</h2></summary>
              <pre className="prompt-block">{lastAiPrompt}</pre>
            </details>
          )}
        </aside>
      </main>
      <footer className="app-footer">
        <div className="footer-links mobile-only" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
             <a 
              href="https://github.com/yuchenzhang/chinese-chess" 
              target="_blank" 
              rel="noopener noreferrer"
              className="nav-link"
            >
              GitHub
            </a>
            <button 
              type="button" 
              className="btn-link" 
              onClick={onShowChangelog}
            >
              更新日志
            </button>
        </div>
        <div style={{ marginBottom: '8px' }}>
          <strong>构建信息:</strong> {buildInfo.full_time}
        </div>
        {buildInfo.last_commits && buildInfo.last_commits.length > 0 && (
          <div className="desktop-only" style={{ fontSize: '0.8rem', justifyContent: 'center' }}>
            <strong>最近更新:</strong> {buildInfo.last_commits[0].hash} - {buildInfo.last_commits[0].message} ({buildInfo.last_commits[0].date})
          </div>
        )}
      </footer>
      {activeModalSnapshot && (
        <TacticalSnapshotModal
          snapshot={activeModalSnapshot}
          onClose={() => setActiveModalSnapshot(null)}
          onStartPractice={startSnapshotPractice}
        />
      )}

      {showImportDialog && (
        <div
          className="dialog-backdrop"
          style={{
            backdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(15, 12, 10, 0.8)',
            zIndex: 1000,
          }}
          onClick={() => setShowImportDialog(false)}
        >
          <div
            className="dialog"
            style={{
              width: 'min(480px, 95vw)',
              padding: '1.5rem',
              borderRadius: '16px',
              background: 'rgba(37, 32, 25, 0.95)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              color: 'var(--text)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--accent)' }}>📥 导入 AI 点评数据</h3>
              <button
                type="button"
                onClick={() => setShowImportDialog(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1, padding: 0 }}
              >
                &times;
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'left' }}>
              请将大模型分析完成后返回的完整的 JSON 代码块粘贴在下方框中，系统将自动解析、校验并匹配加载您的错题本指导。
            </p>

            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='请在此处粘贴 JSON 数据。例如：&#10;{&#10;  "snapshots": [&#10;    {&#10;      "id": "...",&#10;      "hint": "..."&#10;    }&#10;  ]&#10;}'
              style={{
                width: '100%',
                height: '180px',
                borderRadius: '8px',
                padding: '10px',
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                resize: 'vertical',
              }}
            />

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setShowImportDialog(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={handleImportCoaching}
                disabled={!importText.trim()}
              >
                确认导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
