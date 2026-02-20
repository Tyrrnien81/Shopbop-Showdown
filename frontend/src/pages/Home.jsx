import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [username, setUsername] = useState('');

  const handleCreateGame = () => {
    navigate('/create');
  };

  const handleJoinGame = (e) => {
    e.preventDefault();
    if (joinCode && username) {
      navigate(`/lobby/${joinCode}?username=${encodeURIComponent(username)}`);
    }
  };

  return (
    <div className="home-container">
      <div className="home-presented-by">
        <span>Presented by Amazon Shopbop</span>
      </div>

      <div className="home-title">
        <h1>
          <span className="style-text">Style</span>
          <span className="showdown-text">Showdown</span>
        </h1>
      </div>

      <p className="home-tagline">
        Stop guessing. Get instant feedback from friends in a high-stakes style showdown.
        Curated trends, real-time budgets.
      </p>

      <div className="home-actions">
        <button onClick={handleCreateGame} className="btn btn-primary">
          Start a Room
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button onClick={() => setShowJoinModal(true)} className="btn btn-secondary">
          Join Friends
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </button>
      </div>

      {/* Join Modal */}
      {showJoinModal && (
        <div className="join-modal" onClick={() => setShowJoinModal(false)}>
          <div className="join-modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Join a Room</h2>
            <form onSubmit={handleJoinGame}>
              <div className="form-group">
                <label className="form-label">Your Name</label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Room Code</label>
                <input
                  type="text"
                  placeholder="Enter room code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowJoinModal(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Join Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
