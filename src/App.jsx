import { useState } from 'react'
import GameSelection from './components/GameSelection'
import OpenBorPlayer from './components/OpenBorPlayer'

function App() {
  const [selectedGame, setSelectedGame] = useState(null)

  return (
    <div className="app-container">
      <header>
        <h1>OpenBOR Web Archive</h1>
        <p>Play legendary Beat 'em Up games directly in your browser. Fully Xbox controller compatible.</p>
      </header>
      
      {!selectedGame ? (
        <GameSelection onSelectGame={setSelectedGame} />
      ) : (
        <OpenBorPlayer 
          game={selectedGame} 
          onExit={() => setSelectedGame(null)} 
        />
      )}
    </div>
  )
}

export default App
