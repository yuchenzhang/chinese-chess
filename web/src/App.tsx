import { useState } from 'react'
import { ChessGame } from './components/ChessGame'
import { GuideTour } from './components/GuideTour'
import { ChangelogPage } from './components/ChangelogPage'
import './App.css'

type View = 'game' | 'changelog'

function App() {
  const [view, setView] = useState<View>('game')

  return (
    <>
      {view === 'game' ? (
        <ChessGame onShowChangelog={() => setView('changelog')} />
      ) : (
        <ChangelogPage onBack={() => setView('game')} />
      )}
      <GuideTour />
    </>
  )
}

export default App
