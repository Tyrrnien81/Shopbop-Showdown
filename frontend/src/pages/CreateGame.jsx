import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { gameApi } from '../services/api';
import useGameStore from '../store/gameStore';

const themes = [
  { id: 'runway', name: 'Runway Ready', description: 'High-fashion editorial looks.', icon: '✨' },
  { id: 'trend', name: '2026 Trend Watch', description: 'The latest silhouettes and textures.', icon: '⚡' },
  { id: 'ski', name: 'Apres Ski Chic', description: 'Luxury winter style for the lodge.', icon: '❄️' },
  { id: 'street', name: 'Streetwear Icon', description: 'Urban staples and bold statements.', icon: '🏙️' },
  { id: 'gala', name: 'Met Gala: Camp', description: 'Everything is extra. No limits.', icon: '💎' },
  { id: 'beach', name: 'Beach Vacation', description: 'Resort wear and summer essentials.', icon: '🏖️' },
];

function CreateGame() {
  const navigate = useNavigate();
  const { setGame, setCurrentPlayer, setLoading, setError, isLoading } = useGameStore();

  const [formData, setFormData] = useState({
    hostUsername: '',
    theme: 'runway',
    budget: 5000,
    maxPlayers: 4,
    timeLimit: 300,
    singlePlayer: false,
    themeMode: 'vote', // 'vote' | 'pick'
    votingMode: 'star', // 'star' | 'ranking'
    roomName: '',
    isPublic: true,
  });

  const handleThemeSelect = (themeId) => {
    setFormData((prev) => ({ ...prev, theme: themeId }));
  };

  const handleBudgetChange = (e) => {
    setFormData((prev) => ({ ...prev, budget: Number(e.target.value) }));
  };

  const handleRandomize = () => {
    const randomTheme = themes[Math.floor(Math.random() * themes.length)];
    const randomBudget = Math.floor(Math.random() * 9500) + 500;
    setFormData((prev) => ({
      ...prev,
      theme: randomTheme.id,
      budget: Math.round(randomBudget / 100) * 100,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = { ...formData };
      // In solo mode, always use host-pick; themeMode only matters for multiplayer
      if (payload.singlePlayer) payload.themeMode = 'pick';
      const response = await gameApi.createGame(payload);
      const { game, player } = response.data;
      setGame(game);
      setCurrentPlayer(player);

      if (formData.singlePlayer) {
        // Auto-start and go straight to game
        await gameApi.startGame(game.gameId, player.playerId);
        navigate(`/game/${game.gameId}`);
      } else {
        navigate(`/lobby/${game.gameId}`);
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to create game');
    } finally {
      setLoading(false);
    }
  };

  const budgetPercentage = ((formData.budget - 500) / (10000 - 500)) * 100;

  return (
    <div className="create-game-container">
      <div className="create-game-main">
        {/* Header */}
        <div className="create-game-header">
          <div className="create-game-header-text">
            <h1>Setup the Vibe</h1>
            <p>Configure your room or let the algorithm decide.</p>
          </div>
          <button type="button" onClick={handleRandomize} className="btn btn-outline">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            Randomize Everything
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Host Username */}
          <div className="username-section">
            <label className="username-label" htmlFor="hostUsername">Your Name</label>
            <input
              id="hostUsername"
              type="text"
              className="username-input"
              placeholder="Enter your display name"
              value={formData.hostUsername}
              onChange={(e) => setFormData(prev => ({ ...prev, hostUsername: e.target.value }))}
              maxLength={20}
              required
            />
          </div>

          {/* Theme Mode Toggle (multiplayer only) */}
          {!formData.singlePlayer && (
            <div className="theme-mode-toggle">
              <span className="theme-mode-label">Theme Selection</span>
              <div className="theme-mode-options">
                <button
                  type="button"
                  className={`theme-mode-btn ${formData.themeMode === 'vote' ? 'active' : ''}`}
                  onClick={() => setFormData(prev => ({ ...prev, themeMode: 'vote' }))}
                >
                  <span className="theme-mode-btn-icon">🗳️</span>
                  <span>Players Vote</span>
                </button>
                <button
                  type="button"
                  className={`theme-mode-btn ${formData.themeMode === 'pick' ? 'active' : ''}`}
                  onClick={() => setFormData(prev => ({ ...prev, themeMode: 'pick' }))}
                >
                  <span className="theme-mode-btn-icon">👑</span>
                  <span>Host Picks</span>
                </button>
              </div>
            </div>
          )}

          {/* Theme grid — shown in solo mode OR when host picks */}
          {(formData.singlePlayer || formData.themeMode === 'pick') ? (
            <div className="theme-section">
              <div className="theme-grid">
                {themes.map((theme) => (
                  <div
                    key={theme.id}
                    className={`theme-card ${formData.theme === theme.id ? 'selected' : ''}`}
                    onClick={() => handleThemeSelect(theme.id)}
                  >
                    <div className="theme-icon">{theme.icon}</div>
                    <div className="theme-info">
                      <h4>{theme.name}</h4>
                      <p>{theme.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="theme-section theme-vote-preview">
              <div className="theme-vote-preview-icons">
                {['✨', '⚡', '❄️', '🏙️', '💎', '🏖️'].map((icon, i) => (
                  <span key={i} className="theme-vote-preview-icon" style={{ animationDelay: `${i * 0.1}s` }}>{icon}</span>
                ))}
              </div>
              <h3>Players Vote on the Theme</h3>
              <p>3 random themes will appear after launch — everyone votes, majority wins!</p>
            </div>
          )}

          {/* Budget Slider */}
          <div className="budget-section">
            <div className="budget-header">
              <span className="budget-label">Custom Budget Limit</span>
              <span className="budget-value">${formData.budget.toLocaleString()}</span>
            </div>
            <div className="budget-slider">
              <input
                type="range"
                min="500"
                max="10000"
                step="100"
                value={formData.budget}
                onChange={handleBudgetChange}
                style={{ '--value': `${budgetPercentage}%` }}
              />
            </div>
            <div className="budget-labels">
              <span>Street ($500)</span>
              <span>Couture ($10,000)</span>
            </div>
          </div>

          {/* Time Limit Selector */}
          <div className="time-limit-section">
            <span className="time-limit-label">Time Limit</span>
            <div className="time-limit-options">
              {[
                { value: 120, label: '2 min', desc: 'Speed Round' },
                { value: 300, label: '5 min', desc: 'Standard' },
                { value: 600, label: '10 min', desc: 'Relaxed' },
                { value: 900, label: '15 min', desc: 'Curate' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`time-limit-btn ${formData.timeLimit === opt.value ? 'selected' : ''}`}
                  onClick={() => setFormData(prev => ({ ...prev, timeLimit: opt.value }))}
                >
                  <span className="time-limit-btn-value">{opt.label}</span>
                  <span className="time-limit-btn-desc">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Voting Mode Toggle (multiplayer only) */}
          {!formData.singlePlayer && (
            <div className="theme-mode-toggle">
              <span className="theme-mode-label">Voting Style</span>
              <div className="theme-mode-options">
                <button
                  type="button"
                  className={`theme-mode-btn ${formData.votingMode === 'star' ? 'active' : ''}`}
                  onClick={() => setFormData(prev => ({ ...prev, votingMode: 'star' }))}
                >
                  <span className="theme-mode-btn-icon">★</span>
                  <span>Star Rating</span>
                </button>
                <button
                  type="button"
                  className={`theme-mode-btn ${formData.votingMode === 'ranking' ? 'active' : ''}`}
                  onClick={() => setFormData(prev => ({ ...prev, votingMode: 'ranking' }))}
                >
                  <span className="theme-mode-btn-icon">#</span>
                  <span>Rank Outfits</span>
                </button>
              </div>
            </div>
          )}

          {/* Solo Mode Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px',
          }}>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, singlePlayer: !prev.singlePlayer }))}
              style={{
                width: '44px',
                height: '24px',
                borderRadius: '12px',
                border: 'none',
                background: formData.singlePlayer ? 'var(--primary-orange)' : 'var(--border-medium)',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: 'white',
                position: 'absolute',
                top: '3px',
                left: formData.singlePlayer ? '23px' : '3px',
                transition: 'left 0.2s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
              }} />
            </button>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-dark)', fontWeight: 500 }}>
              Solo Mode
            </span>
          </div>
          
          {/* Room Settings */}
          {!formData.singlePlayer && (
            <div style={{ marginBottom: '24px' }}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '6px' }}>
                  Room Name <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder={`${formData.hostUsername}'s Room`}
                  value={formData.roomName}
                  onChange={(e) => setFormData(prev => ({ ...prev, roomName: e.target.value }))}
                  maxLength={40}
                  style={{
                    width: '100%',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, isPublic: !prev.isPublic }))}
                  style={{
                    width: '44px',
                    height: '24px',
                    borderRadius: '12px',
                    border: 'none',
                    background: formData.isPublic ? 'var(--primary-orange)' : 'var(--border-medium)',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: 'white',
                    position: 'absolute',
                    top: '3px',
                    left: formData.isPublic ? '23px' : '3px',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                  }} />
                </button>
                <div>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-dark)', fontWeight: 500 }}>
                    {formData.isPublic ? 'Public Room' : 'Private Room'}
                  </span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: '2px 0 0' }}>
                    {formData.isPublic ? 'Anyone can find and join this room' : 'Only people with the code can join'}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Launch Button */}
          <div className="create-game-footer">
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Launch Showdown'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </button>
          </div>
        </form>
      </div>

      {/* Room Members Sidebar */}
      <div className="room-members-sidebar">
        <div className="room-members-header">
          Room Members
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto' }}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>

        <div className="member-item">
          <div className="member-avatar">
            <img
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.hostUsername || 'host'}`}
              alt={formData.hostUsername || 'Host'}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
          <div className="member-info">
            <div className="member-name">
              {formData.hostUsername || 'You'}
              <span style={{ marginLeft: '6px', fontSize: '0.8rem' }}>👑</span>
            </div>
            <div className="member-status">Active</div>
          </div>
        </div>

        <p style={{ color: 'var(--text-light)', fontSize: '0.8rem', marginTop: '20px', lineHeight: 1.4 }}>
          Share the room code after launching to invite friends.
        </p>
      </div>
    </div>
  );
}

export default CreateGame;
