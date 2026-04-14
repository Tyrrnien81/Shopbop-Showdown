import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { gameApi } from '../services/api';

function JoinRedirect() {
  const { gameId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if the game exists before sending the user to the lobby
    const checkGame = async () => {
      try {
        await gameApi.getGame(gameId);
        // Game exists — send to lobby (which will show the join form)
        const username = searchParams.get('username');
        if (username) {
          navigate(`/lobby/${gameId}?username=${encodeURIComponent(username)}`, { replace: true });
        } else {
          navigate(`/lobby/${gameId}`, { replace: true });
        }
      } catch {
        setError('Game not found. Check the code and try again.');
        setLoading(false);
      }
    };
    checkGame();
  }, [gameId, navigate, searchParams]);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-cream)' }}>
        <div style={{ textAlign: 'center', padding: '2rem', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: '400px' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>Invalid Room Code</h2>
          <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: '0.9rem' }}>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-cream)' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" />
        <p style={{ color: '#666', marginTop: '12px' }}>Joining room {gameId}...</p>
      </div>
    </div>
  );
}

export default JoinRedirect;
