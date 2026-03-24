import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gameApi } from '../services/api';
import useGameStore from '../store/gameStore';
import socketService from '../services/socket';

function ThemeVote() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { currentPlayer, setGame } = useGameStore();

  const [options, setOptions] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [voteCount, setVoteCount] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [winningTheme, setWinningTheme] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const endsAtRef = useRef(null);
  const timerRef = useRef(null);

  // Fetch theme vote state on mount
  useEffect(() => {
    const fetchVoteState = async () => {
      try {
        const res = await gameApi.getThemeVote(gameId);
        setOptions(res.data.options);
        setVoteCount(res.data.voteCount);
        setTotalPlayers(res.data.totalPlayers);
      } catch {
        // Theme vote may have already ended
        const gameRes = await gameApi.getGame(gameId);
        if (gameRes.data.status === 'PLAYING') {
          navigate(`/game/${gameId}`);
        }
      }
    };
    fetchVoteState();
  }, [gameId, navigate]);

  // Socket listeners
  useEffect(() => {
    if (!currentPlayer?.playerId) return;

    socketService.connect(gameId, currentPlayer.playerId);

    const onThemeVoteStart = ({ options: opts, endsAt, duration }) => {
      setOptions(opts);
      endsAtRef.current = new Date(endsAt);
      setTimeLeft(duration);
    };

    const onThemeVoteUpdate = ({ voteCount: vc, totalPlayers: tp }) => {
      setVoteCount(vc);
      setTotalPlayers(tp);
    };

    const onThemeVoteResult = ({ winningTheme: wt, winningThemeName }) => {
      setWinningTheme({ id: wt, name: winningThemeName });
      setShowResult(true);
    };

    const onGameStarted = () => {
      navigate(`/game/${gameId}`);
    };

    socketService.on('theme-vote-start', onThemeVoteStart);
    socketService.on('theme-vote-update', onThemeVoteUpdate);
    socketService.on('theme-vote-result', onThemeVoteResult);
    socketService.on('game-started', onGameStarted);

    return () => {
      socketService.off('theme-vote-start', onThemeVoteStart);
      socketService.off('theme-vote-update', onThemeVoteUpdate);
      socketService.off('theme-vote-result', onThemeVoteResult);
      socketService.off('game-started', onGameStarted);
    };
  }, [currentPlayer?.playerId, gameId, navigate]);

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const handleVote = async (themeId) => {
    if (hasVoted) return;
    setSelectedTheme(themeId);
    setHasVoted(true);
    try {
      await gameApi.voteTheme(gameId, {
        playerId: currentPlayer?.playerId,
        themeId,
      });
    } catch (err) {
      console.error('Vote error:', err);
    }
  };

  // Winning theme reveal screen
  if (showResult && winningTheme) {
    const themeObj = options.find(t => t.id === winningTheme.id) || {};
    return (
      <div className="theme-vote-container">
        <div className="theme-vote-result-reveal">
          <div className="theme-result-icon">{themeObj.icon || '🎨'}</div>
          <h1 className="theme-result-title">The Theme Is...</h1>
          <h2 className="theme-result-name">{winningTheme.name}</h2>
          <p className="theme-result-desc">{themeObj.description}</p>
          <div className="theme-result-loading">
            <div className="spinner" />
            <span>Starting game...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-vote-container">
      <div className="theme-vote-header">
        <h1>Vote for the Theme</h1>
        <p>Choose the style challenge for this round</p>
      </div>

      {/* Timer */}
      <div className="theme-vote-timer-wrap">
        <div className="theme-vote-timer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className={`theme-vote-timer-text ${timeLeft <= 5 ? 'urgent' : ''}`}>
            {timeLeft}s
          </span>
        </div>
        <div className="theme-vote-progress-bar">
          <div
            className="theme-vote-progress-fill"
            style={{ width: `${(timeLeft / 15) * 100}%` }}
          />
        </div>
      </div>

      {/* Theme Options */}
      <div className="theme-vote-options">
        {options.map((theme) => (
          <button
            key={theme.id}
            className={`theme-vote-card ${selectedTheme === theme.id ? 'selected' : ''} ${hasVoted && selectedTheme !== theme.id ? 'dimmed' : ''}`}
            onClick={() => handleVote(theme.id)}
            disabled={hasVoted}
          >
            <div className="theme-vote-card-icon">{theme.icon}</div>
            <div className="theme-vote-card-info">
              <h3>{theme.name}</h3>
              <p>{theme.description}</p>
            </div>
            {selectedTheme === theme.id && (
              <div className="theme-vote-check">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Vote status */}
      <div className="theme-vote-status">
        {hasVoted ? (
          <p>Your vote is in! Waiting for others... <strong>{voteCount}/{totalPlayers}</strong> voted</p>
        ) : (
          <p>Tap a theme to vote <span className="theme-vote-count">{voteCount}/{totalPlayers} voted</span></p>
        )}
      </div>
    </div>
  );
}

export default ThemeVote;
