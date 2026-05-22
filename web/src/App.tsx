import { useState } from 'react'
import { ChessGame } from './components/ChessGame'
import { GuideTour } from './components/GuideTour'
import { ChangelogPage } from './components/ChangelogPage'
import { EngineExplanationPage } from './components/EngineExplanationPage'
import './App.css'

type View = 'game' | 'changelog' | 'engine-explanation'

function App() {
  const [view, setView] = useState<View>('game')

  return (
    <>
      {view === 'game' ? (
        <ChessGame 
          onShowChangelog={() => setView('changelog')} 
          onShowExplanation={() => setView('engine-explanation')}
        />
      ) : view === 'changelog' ? (
        <ChangelogPage onBack={() => setView('game')} />
      ) : (
        <EngineExplanationPage onBack={() => setView('game')} />
      )}
      <GuideTour />
    </>
  )
}

export default App

