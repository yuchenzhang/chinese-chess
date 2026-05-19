import { BOARD_SIZE, useChessGame } from '../hooks/useChessGame'
import { useReplay } from '../hooks/useReplay'
import { getAiSide } from '../utils/chessSides'
import { peiceSideMap, type PieceSide } from 'zh-chess'
import { LlmSettings } from './LlmSettings'
import { SessionList } from './SessionList'
import { ReplayControls } from './ReplayControls'

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
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            棋
          </span>
          <div>
            <h1>中国象棋</h1>
            <p className="tagline">人机对弈 · AI 教练（建设中）</p>
          </div>
        </div>
        <span className="phase-badge">{gameMode}</span>
      </header>

      <main className="layout">
        <section className="board-panel" aria-label="棋盘">
          <div className="board-frame">
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
                {replay.isReplaying && (
                  <span className="board-blocker-text">回放中</span>
                )}
              </div>
            )}
          </div>
        </section>

        <aside className="sidebar">
          <SessionList
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelect={switchSession}
            onCreate={createSession}
            onDelete={deleteSession}
            onRename={renameSession}
          />

          <LlmSettings />

          <section className="card">
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

          <section className="card">
            <h2>走子记录</h2>
            <ReplayControls replay={replay} />
            {moveHistory.length === 0 ? (
              <p className="muted">开局后每步记谱将显示于此</p>
            ) : (
              <ol className="move-list">
                {moveHistory.map((m, i) => (
                  <li
                    key={`${i}-${m.penCode}`}
                    className={replay.isReplaying && i + 1 === replay.currentPly ? 'move-active' : ''}
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
                    {m.inCheck && <span className="check-tag">将</span>}
                  </li>
                ))}
              </ol>
            )}
          </section>

          {lastAiResponse && (
            <section className="card card-muted">
              <h2>引擎分析</h2>
              <p className="hint">决策引擎输出的评估信息</p>
              <pre className="pen-block">{lastAiResponse}</pre>
            </section>
          )}

          {lastAiPrompt && (
            <section className="card card-muted">
              <h2>引擎调试信息</h2>
              <p className="hint">发送给引擎的 FEN 局面和 UCI 着法</p>
              <pre className="prompt-block">{lastAiPrompt}</pre>
              <button
                type="button"
                className="btn btn-sm"
                style={{ marginTop: 8 }}
                onClick={() => navigator.clipboard.writeText(lastAiPrompt)}
              >
                复制到剪贴板
              </button>
            </section>
          )}
        </aside>
      </main>
    </div>
  )
}
