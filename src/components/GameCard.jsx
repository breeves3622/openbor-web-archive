import './GameCard.css'

const GameCard = ({ game, onClick }) => {
  return (
    <div className="glass-panel game-card" onClick={onClick}>
      <div className="game-card-image">
        <img src={game.coverUrl} alt={game.title} />
        <div className="play-overlay">
          <span>Play Now</span>
        </div>
      </div>
      <div className="game-card-content">
        <h3>{game.title}</h3>
        <p>{game.description}</p>
      </div>
    </div>
  )
}

export default GameCard
