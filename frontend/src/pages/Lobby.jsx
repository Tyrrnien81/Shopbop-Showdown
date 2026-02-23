import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { gameApi } from '../services/api';
import useGameStore from '../store/gameStore';

function Lobby() {
  const { gameId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    game,
    players,
    currentPlayer,
    setGame,
    setPlayers,
    setCurrentPlayer,
    setLoading,
    setError,
    isLoading,
    error,
  } = useGameStore();

  const [isHost, setIsHost] = useState(true); // Mock as host for dev

  useEffect(() => {
    // Join game if username is provided in URL
    const username = searchParams.get('username');
    if (username && !currentPlayer) {
      handleJoinGame(username);
    } else {
      fetchGameData();
    }
  }, [gameId]);

  const fetchGameData = async () => {
    setLoading(true);
    try {
      // Mock data for development
      setGame({
        gameId,
        theme: 'Runway Ready',
        budget: 5000,
        maxPlayers: 4,
        timeLimit: 300,
        status: 'LOBBY',
      });
      setPlayers([
        { playerId: '1', username: 'Host', isReady: true, isHost: true },
        { playerId: '2', username: 'FashionQueen', isReady: true },
        { playerId: '3', username: 'StyleGuru', isReady: true },
      ]);
      setCurrentPlayer({ playerId: '1', username: 'Host', isReady: true, isHost: true });
    } catch (error) {
      setError('Failed to load game');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGame = async (username) => {
    setLoading(true);
    try {
      // Mock for development
      setCurrentPlayer({ playerId: 'new', username, isReady: false });
      fetchGameData();
    } catch (error) {
      setError('Failed to join game');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleReady = () => {
    if (currentPlayer) {
      const newReadyState = !currentPlayer.isReady;
      setCurrentPlayer({ ...currentPlayer, isReady: newReadyState });
      // Update in players list too
      setPlayers(players.map(p =>
        p.playerId === currentPlayer.playerId
          ? { ...p, isReady: newReadyState }
          : p
      ));
    }
  };

  const handleStartGame = async () => {
    setLoading(true);
    try {
      navigate(`/game/${gameId}`);
    } catch (error) {
      setError('Failed to start game');
    } finally {
      setLoading(false);
    }
  };

  const copyGameCode = () => {
    navigator.clipboard.writeText(gameId);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="lobby-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading lobby...</p>
        </div>
      </div>
    );
  }

  const allReady = players.length >= 2 && players.every((p) => p.isReady);

  return (
    <div className="lobby-container">
      {/* Header */}
      <header className="lobby-header">
        <h1>Waiting Room</h1>
        <div className="game-code-display">
          <span>{gameId}</span>
          <button onClick={copyGameCode} className="btn btn-small btn-outline">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy
          </button>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      {/* Game Info Cards */}
      {game && (
        <div className="game-info-cards">
          <div className="info-card">
            <div className="info-card-label">Theme</div>
            <div className="info-card-value">{game.theme}</div>
          </div>
          <div className="info-card">
            <div className="info-card-label">Budget</div>
            <div className="info-card-value">${game.budget.toLocaleString()}</div>
          </div>
          <div className="info-card">
            <div className="info-card-label">Time Limit</div>
            <div className="info-card-value">{formatTime(game.timeLimit)}</div>
          </div>
          <div className="info-card">
            <div className="info-card-label">Players</div>
            <div className="info-card-value">{players.length}/{game.maxPlayers}</div>
          </div>
        </div>
      )}

      {/* Players Section */}
      <section className="players-section">
        <h2>Players</h2>
        <div className="players-grid">
          {players.map((player) => (
            <div key={player.playerId} className={`player-card ${player.isReady ? 'ready' : ''}`}>
              <div className="player-avatar" style={{
                background: `linear-gradient(135deg, ${player.isHost ? 'var(--primary-orange)' : '#6B6B6B'}, ${player.isHost ? '#D4520A' : '#4A4A4A'})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '700',
                fontSize: '1.2rem',
              }}>
                {player.username[0].toUpperCase()}
              </div>
              <div className="player-details">
                <div className="player-name">
                  {player.username}
                  {player.isHost && <span style={{ marginLeft: '6px' }}>👑</span>}
                </div>
                <div className="player-status-badge">
                  {player.isReady ? '● Ready' : '○ Not Ready'}
                </div>
              </div>
            </div>
          ))}

          {/* Empty slots */}
          {game && [...Array(Math.max(0, game.maxPlayers - players.length))].map((_, i) => (
            <div key={`empty-${i}`} className="player-card" style={{ opacity: 0.4, border: '2px dashed var(--border-light)' }}>
              <div className="player-avatar" style={{
                background: 'var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-light)',
                fontSize: '1.5rem',
              }}>
                ?
              </div>
              <div className="player-details">
                <div className="player-name" style={{ color: 'var(--text-light)' }}>Waiting...</div>
                <div className="player-status-badge">Empty Slot</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Actions */}
      <div className="lobby-actions">
        <button onClick={handleToggleReady} className={`btn ${currentPlayer?.isReady ? 'btn-secondary' : 'btn-outline'}`}>
          {currentPlayer?.isReady ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Ready!
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
              </svg>
              Mark Ready
            </>
          )}
        </button>

        {isHost && (
          <button
            onClick={handleStartGame}
            className="btn btn-primary"
            disabled={!allReady}
          >
            {allReady ? (
              <>
                Start Showdown
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </>
            ) : (
              <>
                Waiting for Players...
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default Lobby;
