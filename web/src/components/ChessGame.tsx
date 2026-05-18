import { BOARD_SIZE, useChessGame } from '../hooks/useChessGame'
import { peiceSideMap, type PieceSide } from 'zh-chess'
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
    currentTurn,
    positionPen,
    moveHistory,
    winner,
    statusMessage,
    startNewGame,
    flipBoard,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
  } = useChessGame()

  const canChangeSide = activeSession.status === 'setup' || !!winner
  const startLabel =
    activeSession.status === 'setup' ? '开始对局' : '重开对局'

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            棋
          </span>
          <div>
            <h1>中国象棋</h1>
            <p className="tagline">对弈 · 训练 · AI 教练（建设中）</p>
          </div>
        </div>
        <span className="phase-badge">Phase 1 · 本地对弈</span>
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

          <section className="card">
            <h2>对局</h2>
            <p className="status">{statusMessage}</p>
            {currentTurn && !winner && (
              <p className="turn">
                当前行棋：
                <strong>{peiceSideMap[currentTurn]}</strong>
              </p>
            )}
            {winner && (
              <p className="winner">
                胜方：<strong>{peiceSideMap[winner]}</strong>
              </p>
            )}

            <label className="field">
              <span>你的阵营（视角）</span>
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
              <button type="button" className="btn primary" onClick={startNewGame}>
                {startLabel}
              </button>
              <button type="button" className="btn" onClick={flipBoard}>
                翻转视角
              </button>
            </div>
          </section>

          <section className="card">
            <h2>走子记录</h2>
            {moveHistory.length === 0 ? (
              <p className="muted">开局后每步 PEN 记谱将显示于此</p>
            ) : (
              <ol className="move-list">
                {moveHistory.map((m, i) => (
                  <li key={`${i}-${m.penCode}`}>
                    <span className="move-no">{i + 1}.</span>
                    <span className="move-side">{peiceSideMap[m.side]}</span>
                    <code>{m.penCode}</code>
                    {m.inCheck && <span className="check-tag">将</span>}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="card card-muted">
            <h2>局面 PEN</h2>
            <p className="hint">供 Phase 2 大模型读盘与回棋</p>
            <pre className="pen-block">{positionPen || '—'}</pre>
          </section>
        </aside>
      </main>
    </div>
  )
}
