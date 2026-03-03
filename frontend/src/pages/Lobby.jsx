import { useEffect, useState, useRef } from 'react';
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

  const [joining, setJoining] = useState(false);
  const [joinUsername, setJoinUsername] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);
  const pollRef = useRef(null);
  const hasJoinedRef = useRef(false); // guard against StrictMode double-invoke

  const isHost = currentPlayer?.isHost ?? false;

  useEffect(() => {
    const username = searchParams.get('username');
    if (username && !currentPlayer && !hasJoinedRef.current) {
      hasJoinedRef.current = true;
      handleJoinGame(username);
    } else if (currentPlayer?.gameId === gameId) {
      // Already in game — just fetch fresh data and start polling
      fetchGameData();
      startPolling();
    } else {
      // Landed directly on lobby URL — show join form
      fetchGameData();
      setShowJoinForm(true);
    }

    return () => stopPolling();
  }, [gameId]);

  const startPolling = () => {
    stopPolling();
    pollRef.current = setInterval(() => {
      fetchGameData(true); // silent=true so we don't show loading spinner
    }, 2500);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const fetchGameData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await gameApi.getGame(gameId);
      const data = response.data;
      setGame(data);
      setPlayers(data.players || []);

      // If game started, navigate to game page
      if (data.status === 'PLAYING') {
        stopPolling();
        navigate(`/game/${gameId}`);
      }
    } catch {
      if (!silent) setError('Failed to load game');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleJoinGame = async (username) => {
    setJoining(true);
    try {
      const response = await gameApi.joinGame(gameId, { username });
      const { player, game: joinedGame } = response.data;
      setCurrentPlayer(player);
      setGame(joinedGame);
      setPlayers(joinedGame.players || []);
      setShowJoinForm(false);
      startPolling();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to join game');
    } finally {
      setJoining(false);
    }
  };

  const handleToggleReady = async () => {
    if (!currentPlayer) return;
    const newReady = !currentPlayer.isReady;
    try {
      await gameApi.readyToggle(gameId, { playerId: currentPlayer.playerId, isReady: newReady });
      setCurrentPlayer({ ...currentPlayer, isReady: newReady });
      setPlayers(players.map(p =>
        p.playerId === currentPlayer.playerId ? { ...p, isReady: newReady } : p
      ));
    } catch {
      setError('Failed to update ready status');
    }
  };

  const handleStartGame = async () => {
    setLoading(true);
    try {
      await gameApi.startGame(gameId);
      stopPolling();
      navigate(`/game/${gameId}`);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to start game');
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

  // Join form for players arriving via direct link
  if (showJoinForm && !currentPlayer) {
    return (
      <div className="lobby-container">
        <header className="lobby-header">
          <h1>Join Game</h1>
          <div className="game-code-display">
            <span>{gameId}</span>
          </div>
        </header>
        <div style={{ maxWidth: '400px', margin: '40px auto', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-light)', marginBottom: '24px' }}>Enter your name to join the showdown</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <input
              type="text"
              placeholder="Your fashion name..."
              value={joinUsername}
              onChange={(e) => setJoinUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && joinUsername.trim() && handleJoinGame(joinUsername.trim())}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '1rem',
                width: '220px',
              }}
            />
            <button
              onClick={() => joinUsername.trim() && handleJoinGame(joinUsername.trim())}
              className="btn btn-primary"
              disabled={joining || !joinUsername.trim()}
            >
              {joining ? 'Joining...' : 'Join'}
            </button>
          </div>
          {error && <div className="error-message" style={{ marginTop: '16px' }}>{error}</div>}
        </div>
      </div>
    );
  }

  if (isLoading && !game) {
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
            <div className="info-card-value">{game.themeName || game.theme}</div>
          </div>
          <div className="info-card">
            <div className="info-card-label">Budget</div>
            <div className="info-card-value">${game.budget?.toLocaleString()}</div>
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

      {/* Share Link */}
      {currentPlayer && (
        <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.85rem', marginBottom: '8px' }}>
          Share this link to invite friends:{' '}
          <code style={{ color: 'var(--text-primary)' }}>
            {window.location.origin}/lobby/{gameId}?username=FriendName
          </code>
        </div>
      )}

      {/* Actions */}
      <div className="lobby-actions">
        {currentPlayer && (
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
        )}

        {isHost && (
          <button
            onClick={handleStartGame}
            className="btn btn-primary"
            disabled={!allReady || isLoading}
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
