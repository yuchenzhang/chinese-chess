import { BOARD_SIZE, useChessGame } from '../hooks/useChessGame'
import { useReplay } from '../hooks/useReplay'
import { getAiSide } from '../utils/chessSides'
import { peiceSideMap, type PieceSide } from 'zh-chess'
import { LlmSettings } from './LlmSettings'
import { SessionList } from './SessionList'
import { ReplayControls } from './ReplayControls'
import { CapturedPieces } from './CapturedPieces'

const SIDE_OPTIONS: { value: PieceSide; label: string }[] = [
  { value: 'RED', label: '红方（先手）' },
  { value: 'BLACK', label: '黑方' },
]

export function ChessGame() {
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
    startNewGame,
    triggerAiMove,
    flipBoard,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
    patchActiveSession,
    startCoachingScenario,
  } = useChessGame()

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
  
  if (import.meta.env.DEV) {
    console.log('[象棋·DEBUG] UI State:', {
      vsAi,
      status: activeSession.status,
      winner,
      currentTurn,
      aiSide,
      isAiTurn,
      aiThinking
    })
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            type="button" 
            className="btn btn-sm" 
            style={{ borderRadius: '20px', padding: '4px 12px', borderColor: 'var(--accent)', color: 'var(--accent)' }}
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
                width={BOARD_SIZE}
                height={BOARD_SIZE}
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
            <CapturedPieces
              moveHistory={moveHistory}
              maxPly={replay.isReplaying ? replay.currentPly : undefined}
            />
          </div>
        </section>

        <aside className="sidebar">
          <div data-tour="session-list">
            <SessionList
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelect={switchSession}
              onCreate={createSession}
              onDelete={deleteSession}
              onRename={renameSession}
              onStartScenario={startCoachingScenario}
            />
          </div>

          <section className="card" data-tour="game-controls">
            <h2>对局</h2>
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
              {activeSession.isCoaching && !activeSession.coachingInstruction && (
                <button
                  type="button"
                  className="btn-debug-icon"
                  style={{ color: 'var(--accent)', borderColor: 'var(--accent)', marginLeft: '4px' }}
                  title="查看教练指导"
                  onClick={() => {
                    // 调试日志
                    console.log('[象棋·教练] 尝试恢复指导文字...', {
                      sessionTitle: activeSession.title,
                      hasAnalysis: !!activeSession.llmAnalysis,
                      scenariosCount: activeSession.llmAnalysis?.coaching_scenarios?.length
                    });

                    // 1. 尝试从 coaching_scenarios 中找标题匹配的
                    // 2. 找不到则找 target_ply 匹配的（如果有）
                    // 3. 实在找不到则取第一个作为兜底
                    const scenarios = activeSession.llmAnalysis?.coaching_scenarios || [];
                    const scenario = scenarios.find(s => s.title === activeSession.title) || scenarios[0];
                    const instruction = scenario?.instruction;
                    
                    if (instruction) {
                      console.log('[象棋·教练] 成功找到指导文字');
                      patchActiveSession({ coachingInstruction: instruction });
                    } else {
                      console.warn('[象棋·教练] 未找到匹配的指导文字');
                      alert('抱歉，未能找回该局的教练指导。您可以尝试重新导入 AI 分析。');
                    }
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>💡</span>
                </button>
              )}
            </div>
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

            <label className="field field-checkbox">
              <input
                type="checkbox"
                checked={vsAi}
                onChange={(e) => setVsAi(e.target.checked)}
                disabled={activeSession.status === 'active' && !winner}
              />
              <span>开启 AI 对弈</span>
            </label>

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

            <div className="actions">
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
              <button type="button" className="btn" onClick={flipBoard}>
                翻转视角
              </button>
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

          <LlmSettings />

          {lastAiResponse && (
            <details className="card card-muted" open>
              <summary style={{ cursor: 'pointer' }}><h2 style={{ display: 'inline', margin: 0 }}>引擎分析</h2></summary>
              <p className="hint" style={{ marginTop: '0.5rem' }}>决策引擎输出的评估信息</p>
              <pre className="pen-block">{lastAiResponse}</pre>
            </details>
          )}

          {lastAiPrompt && (
            <details className="card card-muted" open>
              <summary style={{ cursor: 'pointer' }}><h2 style={{ display: 'inline', margin: 0 }}>引擎调试信息</h2></summary>
              <p className="hint" style={{ marginTop: '0.5rem' }}>发送给引擎的 FEN 局面和 UCI 着法</p>
              <pre className="prompt-block">{lastAiPrompt}</pre>
              <button
                type="button"
                className="btn btn-sm"
                style={{ marginTop: 8 }}
                onClick={() => navigator.clipboard.writeText(lastAiPrompt)}
              >
                复制到剪贴板
              </button>
            </details>
          )}
        </aside>
      </main>
    </div>
  )
}
