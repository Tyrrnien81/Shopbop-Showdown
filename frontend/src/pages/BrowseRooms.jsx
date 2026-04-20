import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gameApi } from '../services/api';

function BrowseRooms() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchGames = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await gameApi.getPublicGames();
      setGames(res.data.games || []);
    } catch {
      setError('Failed to load rooms. Try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  const handleJoin = (gameId) => {
    navigate(`/join/${gameId}`);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-cream)', padding: '40px 20px' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <button
              onClick={() => navigate('/')}
              style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', fontSize: '0.85rem', padding: '0', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              Live Rooms
            </h1>
            <p style={{ color: 'var(--text-light)', margin: '4px 0 0', fontSize: '0.9rem' }}>
              Join an ongoing showdown as a player or audience member
            </p>
          </div>
          <button onClick={fetchGames} className="btn btn-outline" disabled={loading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: loading ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s' }}>
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="error-message" style={{ marginBottom: '20px' }}>{error}</div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div className="spinner" />
            <p style={{ color: 'var(--text-light)', marginTop: '12px' }}>Finding rooms...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && games.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)', borderRadius: '16px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎭</div>
            <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>No rooms right now</h3>
            <p style={{ color: 'var(--text-light)', marginBottom: '24px', fontSize: '0.9rem' }}>
              Be the first to start a showdown!
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/create')}>
              Start a Room
            </button>
          </div>
        )}

        {/* Game list */}
        {!loading && games.map(game => (
          <div
            key={game.gameId}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: '16px',
              padding: '20px 24px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '600', fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {game.roomName}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '0.8rem', color: 'var(--text-light)' }}>
                <span>🎨 {game.themeName}</span>
                <span>💰 ${game.budget?.toLocaleString()}</span>
                <span>⏱ {formatTime(game.timeLimit)}</span>
                <span>👥 {game.playerCount}/{game.maxPlayers}</span>
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => handleJoin(game.gameId)}
              disabled={game.playerCount >= game.maxPlayers}
              style={{ flexShrink: 0 }}
            >
              {game.playerCount >= game.maxPlayers ? 'Full' : 'Join'}
            </button>
          </div>
        ))}

      </div>
    </div>
  );
}

export default BrowseRooms;