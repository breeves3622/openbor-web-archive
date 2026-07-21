import games from '../games.json'
import GameCard from './GameCard'
import './GameSelection.css'

const GameSelection = ({ onSelectGame }) => {
  return (
    <div className="game-selection">
      <div className="games-grid">
        {games.map(game => (
          <GameCard 
            key={game.id} 
            game={game} 
            onClick={() => onSelectGame(game)} 
          />
        ))}
      </div>
    </div>
  )
}

export default GameSelection
