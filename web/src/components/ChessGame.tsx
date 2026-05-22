import { useChessGame } from '../hooks/useChessGame'
import { useReplay } from '../hooks/useReplay'
import { getAiSide } from '../utils/chessSides'
import { peiceSideMap, type PieceSide } from 'zh-chess'
import { LlmSettings } from './LlmSettings'
import { SessionList } from './SessionList'
import { ReplayControls } from './ReplayControls'
import { CapturedPieces } from './CapturedPieces'
import buildInfo from '../build-info.json'
import { useState } from 'react'

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
    startCoachingScenario,
    triggerAiMove,
    undoMove,
    clearKeyPieceAlert,
    flipBoard,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
    patchActiveSession,
    boardSize,
  } = useChessGame()

  const [showSettings, setShowSettings] = useState(false)
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
          <nav className="desktop-nav">
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
            <div className="board-frame" data-tour="board">
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
                  {replay.isReplaying && !activeSession.llmAnalysis && (
                    <span className="board-blocker-text">回放中</span>
                  )}
                </div>
              )}
              {replay.isReplaying && activeSession.llmAnalysis && (() => {
                const isSummary = replay.currentPly === 0;
                const annotation = activeSession.llmAnalysis.annotations.find(a => a.ply === replay.currentPly);
                
                if (!isSummary && !annotation) return null;
                
                return (
                  <div className="llm-board-overlay" style={{
                    position: 'absolute',
                    top: '10%',
                    left: '5%',
                    right: '5%',
                    background: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                    padding: '16px',
                    borderRadius: '12px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                    border: '1px solid var(--border)',
                    zIndex: 30,
                    pointerEvents: 'none',
                    lineHeight: 1.5
                  }}>
                    {isSummary ? (
                      <div>
                        <h3 style={{ marginTop: 0, marginBottom: '8px', fontSize: '1.1rem', color: 'var(--accent)' }}>AI 教练总结</h3>
                        <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text)' }}>{activeSession.llmAnalysis.summary.overall}</p>
                        {activeSession.llmAnalysis.summary.main_problems?.length > 0 && (
                          <div style={{ marginTop: '8px' }}>
                            <strong style={{ fontSize: '0.9rem', color: 'var(--accent)' }}>主要问题：</strong>
                            <ul style={{ margin: '4px 0 0', paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--text)' }}>
                              {activeSession.llmAnalysis.summary.main_problems.map((p, idx) => <li key={idx} style={{ marginBottom: '4px' }}>{p}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.85rem', padding: '2px 8px', background: 'var(--accent)', color: '#fff', borderRadius: '12px', fontWeight: 'bold', lineHeight: 1.2 }}>
                            {annotation!.quality}
                          </span>
                          {annotation!.tags?.map(tag => (
                            <span key={tag} style={{ fontSize: '0.8rem', padding: '2px 8px', background: 'var(--surface)', color: 'var(--text-muted)', borderRadius: '12px', border: '1px solid var(--border)', lineHeight: 1.2 }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                        <p style={{ margin: 0, fontSize: '1rem', color: 'var(--text)' }}>{annotation!.comment}</p>
                      </div>
                    )}
                  </div>
                )
              })()}
              
              {keyPieceAlert && !replay.isReplaying && (
                <div className="coaching-overlay" style={{
                  position: 'absolute',
                  top: '30%',
                  left: '10%',
                  right: '10%',
                  background: 'rgba(255, 255, 255, 0.98)',
                  backdropFilter: 'blur(8px)',
                  padding: '24px',
                  borderRadius: '16px',
                  boxShadow: '0 12px 48px rgba(0,0,0,0.3)',
                  border: '2px solid var(--error, #e11d48)',
                  zIndex: 100,
                  textAlign: 'center',
                }}>
                  <h3 style={{ margin: '0 0 16px', color: 'var(--error, #e11d48)', fontSize: '1.4rem' }}>
                    ⚠️ 注意
                  </h3>
                  <p style={{ fontSize: '1.1rem', marginBottom: '24px', color: '#1a1a1a' }}>
                    你的<strong>{keyPieceAlert.pieceName}</strong>被吃掉了！是否需要悔棋纠正错误？
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                    <button 
                      className="btn primary" 
                      style={{ padding: '8px 24px', borderRadius: '20px', backgroundColor: 'var(--error, #e11d48)', borderColor: 'var(--error, #e11d48)' }}
                      onClick={undoMove}
                    >
                      悔棋
                    </button>
                    <button 
                      className="btn" 
                      style={{ padding: '8px 24px', borderRadius: '20px' }}
                      onClick={clearKeyPieceAlert}
                    >
                      继续
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
              onStartScenario={(s) => { startCoachingScenario(s); setShowSettings(false); }}
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
              session={activeSession} 
              onImportAnalysis={(analysis) => patchActiveSession({ llmAnalysis: analysis })} 
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
    </div>
  )
}
