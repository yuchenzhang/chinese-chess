import { BOARD_SIZE, useChessGame } from '../hooks/useChessGame'
import { getAiSide } from '../utils/chessSides'
import { peiceSideMap, type PieceSide } from 'zh-chess'
import { LlmSettings } from './LlmSettings'
import { SessionList } from './SessionList'

const SIDE_OPTIONS: { value: PieceSide; label: string }[] = [
  { value: 'RED', label: '红方（先手）' },
  { value: 'BLACK', label: '黑方' },
]

export function ChessGame() {
  const {
    canvasRef,
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
    vsAi &&
    activeSession.status === 'active' &&
    !winner &&
    (aiThinking || (currentTurn != null && currentTurn !== playerSide))

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
        <span className="phase-badge">人机对弈</span>
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
                {aiThinking && <span className="board-blocker-text">AI 思考中…</span>}
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
            <p className={`status${statusMessage.includes('失败') || statusMessage.includes('API') ? ' status-error' : ''}`}>
              {statusMessage}
            </p>
            {vsAi && activeSession.status === 'active' && !winner && (
              <p className="turn matchup">
                你执 <strong>{peiceSideMap[playerSide]}</strong>
                {' · '}
                AI 执 <strong>{peiceSideMap[aiSide]}</strong>
              </p>
            )}
            {currentTurn && !winner && vsAi && (
              <p className="turn">
                当前行棋：
                <strong>
                  {currentTurn === playerSide
                    ? `${peiceSideMap[currentTurn]}（你）`
                    : `${peiceSideMap[currentTurn]}（AI）`}
                </strong>
              </p>
            )}
            {winner && (
              <p className="winner">
                胜方：
                <strong>
                  {winner === playerSide
                    ? `${peiceSideMap[winner]}（你）`
                    : `${peiceSideMap[winner]}（AI）`}
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
              <span>与大模型对弈</span>
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
                disabled={!vsAi || aiThinking}
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
            {moveHistory.length === 0 ? (
              <p className="muted">开局后每步记谱将显示于此</p>
            ) : (
              <ol className="move-list">
                {moveHistory.map((m, i) => (
                  <li key={`${i}-${m.penCode}`}>
                    <span className="move-no">{i + 1}.</span>
                    <span className="move-side">
                      {m.side === playerSide ? '你' : 'AI'}
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
              <h2>大模型最新回复</h2>
              <p className="hint">AI 返回的原始 JSON 内容</p>
              <pre className="pen-block">{lastAiResponse}</pre>
            </section>
          )}

          {lastAiPrompt && (
            <section className="card card-muted">
              <h2>发送给大模型的提示词</h2>
              <p className="hint">包含棋盘视觉与合法着法列表</p>
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
