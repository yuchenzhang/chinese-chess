import buildInfo from '../build-info.json'

interface ChangelogPageProps {
  onBack: () => void
}

export function ChangelogPage({ onBack }: ChangelogPageProps) {
  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            棋
          </span>
          <div>
            <h1>更新日志</h1>
            <p className="tagline">Chinese Chess · Change Log</p>
          </div>
        </div>
        <button 
          type="button" 
          className="btn btn-sm" 
          onClick={onBack}
        >
          返回对弈
        </button>
      </header>

      <main className="layout-single" style={{ justifyContent: 'center' }}>
        <section className="card" style={{ maxWidth: '800px', width: '100%', margin: '0 auto' }}>
          <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
            <h2 style={{ margin: 0 }}>版本历史</h2>
            <p className="muted">最后构建时间：{buildInfo.full_time}</p>
          </div>

          <div className="changelog-list">
            {buildInfo.last_commits.map((commit) => (
              <div 
                key={commit.hash} 
                style={{ 
                  marginBottom: '24px', 
                  paddingLeft: '16px', 
                  borderLeft: '2px solid var(--accent)',
                  position: 'relative'
                }}
              >
                <div style={{ 
                  position: 'absolute', 
                  left: '-5px', 
                  top: '0', 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  background: 'var(--accent)' 
                }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '1.1rem' }}>{commit.message}</strong>
                  <code style={{ fontSize: '0.8rem', background: 'var(--surface)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                    {commit.hash}
                  </code>
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <span>{commit.author}</span>
                  <span style={{ margin: '0 8px' }}>·</span>
                  <span>{commit.date}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <p className="muted">查看更多详细信息请访问我们的 <a href="https://github.com/yuchenzhang/chinese-chess" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>GitHub 仓库</a></p>
          </div>
        </section>
      </main>
      
      <footer className="app-footer" style={{ 
        padding: '24px', 
        textAlign: 'center', 
        color: 'var(--text-muted)', 
        fontSize: '0.85rem', 
        opacity: 0.8
      }}>
        <div>&copy; 2026 中国象棋对弈与训练系统</div>
      </footer>
    </div>
  )
}
