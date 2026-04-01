import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gameApi, outfitApi, voteApi } from '../services/api';
import useGameStore from '../store/gameStore';
import socketService from '../services/socket';

// Mock outfits for development
const mockOutfits = [
  {
    outfitId: 'OUT001',
    playerId: 'P1',
    playerName: 'FashionQueen',
    products: [
      { productSin: 'P001', name: 'Silk Evening Gown', category: 'Dresses', price: 1250, imageUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400' },
      { productSin: 'P002', name: 'Strappy Heels', category: 'Shoes', price: 750, imageUrl: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400' },
      { productSin: 'P003', name: 'Statement Earrings', category: 'Jewelry', price: 425, imageUrl: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400' },
    ],
    totalPrice: 2425,
  },
  {
    outfitId: 'OUT002',
    playerId: 'P2',
    playerName: 'StyleGuru',
    products: [
      { productSin: 'P004', name: 'Oversized Blazer', category: 'Outerwear', price: 2100, imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400' },
      { productSin: 'P005', name: 'Wide Leg Trousers', category: 'Bottoms', price: 385, imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400' },
    ],
    totalPrice: 2485,
  },
  {
    outfitId: 'OUT003',
    playerId: 'P3',
    playerName: 'TrendSetter',
    products: [
      { productSin: 'P006', name: 'Cashmere Sweater', category: 'Tops', price: 695, imageUrl: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400' },
      { productSin: 'P007', name: 'Crocodile Pattern Bag', category: 'Accessories', price: 890, imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400' },
      { productSin: 'P008', name: 'Luxe Leather Sneakers', category: 'Shoes', price: 450, imageUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400' },
    ],
    totalPrice: 2035,
  },
];

function Voting() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const {
    game,
    outfits: allOutfits,
    setOutfits,
    hasVoted,
    setHasVoted,
    setLoading,
    setError,
    error,
    currentPlayer,
  } = useGameStore();

  const votingMode = game?.votingMode || 'star';

  // Filter out the current player's own outfit so they can't vote on it
  const outfits = allOutfits.filter(o => o.playerId !== currentPlayer?.playerId);

  // Star mode state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [ratings, setRatings] = useState({});
  const [hoveredStar, setHoveredStar] = useState(null);
  const [revealing, setRevealing] = useState(true);

  // Ranking mode state
  const [rankedOutfits, setRankedOutfits] = useState([]);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [expandedRankItem, setExpandedRankItem] = useState(null);
  // Touch drag state
  const touchStartY = useRef(null);
  const touchCurrentIndex = useRef(null);

  // Shared state
  const [votingComplete, setVotingComplete] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [voteStatus, setVoteStatus] = useState({ voted: 0, total: 0, players: [] });

  // Initialize rankedOutfits when outfits load (ranking mode)
  useEffect(() => {
    if (votingMode === 'ranking' && outfits.length > 0 && rankedOutfits.length === 0) {
      setRankedOutfits([...outfits]);
    }
  }, [votingMode, outfits, rankedOutfits.length]);

  // Recover game data in store on reload
  useEffect(() => {
    if (!useGameStore.getState().game) {
      gameApi.getGame(gameId).then(res => {
        const g = res.data.game || res.data;
        if (g) useGameStore.getState().setGame(g);
      }).catch(() => {});
    }
  }, [gameId]);

  useEffect(() => {
    fetchOutfits();
    let interval;
    (async () => {
      try {
        const response = await gameApi.getGame(gameId);
        const game = response.data.game || response.data;
        if (game.startedAt && game.timeLimit) {
          const startMs = new Date(game.startedAt).getTime();
          const endMs = startMs + game.timeLimit * 1000;
          const tick = () => {
            const remaining = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
            setTimeLeft(remaining);
            if (remaining <= 0) clearInterval(interval);
          };
          tick();
          interval = setInterval(tick, 1000);
        }
      } catch { /* ignore */ }
    })();
    return () => { if (interval) clearInterval(interval); };
  }, [gameId]);

  // Poll vote status
  useEffect(() => {
    const fetchVoteStatus = async () => {
      try {
        const response = await gameApi.getPlayers(gameId);
        const playerList = response.data.players || [];
        const voted = playerList.filter(p => p.hasVoted).length;
        setVoteStatus({
          voted,
          total: playerList.length,
          players: playerList.map(p => ({ name: p.username, voted: p.hasVoted })),
        });
      } catch { /* ignore */ }
    };
    fetchVoteStatus();
    const poll = setInterval(fetchVoteStatus, 3000);
    return () => clearInterval(poll);
  }, [gameId]);

  // Socket listener for vote completion
  useEffect(() => {
    const { currentPlayer } = useGameStore.getState();
    if (currentPlayer?.playerId) {
      socketService.connect(gameId, currentPlayer.playerId);
    }
    const onVoteSubmitted = ({ isComplete }) => {
      if (isComplete) setVotingComplete(true);
    };
    socketService.on('vote-submitted', onVoteSubmitted);
    return () => socketService.off('vote-submitted', onVoteSubmitted);
  }, [gameId]);

  const handleGoBack = () => navigate(`/game/${gameId}`);

  const fetchOutfits = async () => {
    setLoading(true);
    try {
      const response = await outfitApi.getOutfits(gameId);
      const fetched = response.data.outfits || [];
      setOutfits(fetched.length > 0 ? fetched : mockOutfits);
    } catch {
      setOutfits(mockOutfits);
    } finally {
      setLoading(false);
    }
  };

  // ── Star mode helpers ──
  const currentOutfit = outfits[currentIndex] || mockOutfits[currentIndex];
  const totalOutfits = outfits.length || mockOutfits.length;
  const ratedCount = Object.keys(ratings).length;
  const progressPercentage = votingMode === 'star'
    ? (ratedCount / totalOutfits) * 100
    : 100; // ranking is always "complete"

  const handleRating = (outfitId, rating) => {
    setRatings(prev => ({ ...prev, [outfitId]: rating }));
  };

  const triggerReveal = () => {
    setRevealing(true);
    setTimeout(() => setRevealing(false), 800);
  };

  useEffect(() => { triggerReveal(); }, []);

  const handleNext = () => {
    if (currentIndex < totalOutfits - 1) {
      setCurrentIndex(prev => prev + 1);
      triggerReveal();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      triggerReveal();
    }
  };

  // ── Ranking mode drag-and-drop ──
  const handleDragStart = (index) => {
    setDragIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const updated = [...rankedOutfits];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    setRankedOutfits(updated);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // Touch-based reordering
  const handleTouchStart = (e, index) => {
    touchStartY.current = e.touches[0].clientY;
    touchCurrentIndex.current = index;
    setDragIndex(index);
  };

  const handleTouchMove = useCallback((e) => {
    if (touchStartY.current === null || touchCurrentIndex.current === null) return;
    const touch = e.touches[0];
    const elements = document.querySelectorAll('.rank-item');
    for (let i = 0; i < elements.length; i++) {
      const rect = elements[i].getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        if (i !== touchCurrentIndex.current) {
          setDragOverIndex(i);
        }
        break;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchCurrentIndex.current !== null && dragOverIndex !== null && touchCurrentIndex.current !== dragOverIndex) {
      const updated = [...rankedOutfits];
      const [moved] = updated.splice(touchCurrentIndex.current, 1);
      updated.splice(dragOverIndex, 0, moved);
      setRankedOutfits(updated);
    }
    touchStartY.current = null;
    touchCurrentIndex.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragOverIndex, rankedOutfits]);

  const moveRankItem = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= rankedOutfits.length) return;
    const updated = [...rankedOutfits];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setRankedOutfits(updated);
  };

  // ── Submit votes ──
  const handleSubmitVotes = async () => {
    if (votingMode === 'star' && ratedCount < totalOutfits) {
      setError('Please rate all outfits before submitting');
      return;
    }

    setLoading(true);
    try {
      const { currentPlayer } = useGameStore.getState();

      if (currentPlayer?.playerId) {
        let payload = { gameId, playerId: currentPlayer.playerId };

        if (votingMode === 'ranking') {
          payload.rankings = rankedOutfits.map(o => o.outfitId);
        } else {
          payload.ratings = Object.entries(ratings).map(([outfitId, rating]) => ({ outfitId, rating }));
        }

        const response = await voteApi.castVote(payload);
        const { votesRemaining } = response.data;
        setHasVoted(true);
        if (votesRemaining === 0) setVotingComplete(true);
      } else {
        setHasVoted(true);
        setTimeout(() => setVotingComplete(true), 2000);
      }
    } catch {
      setError('Failed to submit votes');
    } finally {
      setLoading(false);
    }
  };

  const handleViewResults = () => navigate(`/results/${gameId}`);

  // ── Waiting / Complete screens (shared) ──
  if (hasVoted && !votingComplete) {
    return (
      <div className="voting-container">
        <div className="loading" style={{ color: 'white' }}>
          <div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'var(--primary-orange)' }}></div>
          <h2>Vote Submitted!</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>Waiting for other players to vote...</p>
          {voteStatus.total > 0 && (
            <div className="vote-tracker" style={{ marginTop: '24px' }}>
              <div className="vote-tracker-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>{voteStatus.voted}/{voteStatus.total} Players Voted</span>
              </div>
              <div className="vote-tracker-players">
                {voteStatus.players.map((p, i) => (
                  <div key={i} className={`vote-tracker-player ${p.voted ? 'done' : ''}`}>
                    <span className="vote-tracker-dot" />
                    <span className="vote-tracker-name">{p.name}</span>
                    {p.voted ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <span className="vote-tracker-pending">voting...</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (votingComplete) {
    return (
      <div className="voting-container">
        <div className="loading" style={{ color: 'white' }}>
          <h2 style={{ fontSize: '2rem', textTransform: 'uppercase' }}>Voting Complete!</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '24px' }}>All votes are in. Ready to see the winner?</p>
          <button onClick={handleViewResults} className="btn btn-primary">
            View Results
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  if (!currentOutfit && votingMode === 'star') {
    return (
      <div className="voting-container">
        <div className="loading" style={{ color: 'white' }}>
          <div className="spinner"></div>
          <p>Loading outfits...</p>
        </div>
      </div>
    );
  }

  if (votingMode === 'ranking' && rankedOutfits.length === 0) {
    return (
      <div className="voting-container">
        <div className="loading" style={{ color: 'white' }}>
          <div className="spinner"></div>
          <p>Loading outfits...</p>
        </div>
      </div>
    );
  }

  // ── RANKING MODE UI ──
  if (votingMode === 'ranking') {
    return (
      <div className="voting-container">
        <header className="voting-header">
          <div className="voting-header-label">Round Complete</div>
          <h1>Rank the Looks</h1>
          <div className="voting-progress">
            Drag to reorder — best look on top
          </div>
          {timeLeft !== null && timeLeft > 0 && (
            <button onClick={handleGoBack} className="voting-go-back-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Go Back & Edit ({Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')} left)
            </button>
          )}
        </header>

        {/* Live Voting Tracker */}
        {voteStatus.total > 0 && (
          <div className="vote-tracker">
            <div className="vote-tracker-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>{voteStatus.voted}/{voteStatus.total} Votes In</span>
            </div>
            <div className="vote-tracker-players">
              {voteStatus.players.map((p, i) => (
                <div key={i} className={`vote-tracker-player ${p.voted ? 'done' : ''}`}>
                  <span className="vote-tracker-dot" />
                  <span className="vote-tracker-name">{p.name}</span>
                  {p.voted ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span className="vote-tracker-pending">voting...</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="error-message" style={{ maxWidth: '600px', margin: '0 auto 24px' }}>
            {error}
          </div>
        )}

        {/* Ranking List */}
        <div className="ranking-list">
          {rankedOutfits.map((outfit, index) => {
            const isExpanded = expandedRankItem === outfit.outfitId;
            return (
              <div
                key={outfit.outfitId}
                className={`rank-item ${dragIndex === index ? 'rank-dragging' : ''} ${dragOverIndex === index ? 'rank-drag-over' : ''}`}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                onTouchStart={(e) => handleTouchStart(e, index)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <div className="rank-item-main">
                  {/* Rank badge */}
                  <div className="rank-badge">
                    {index + 1}
                  </div>

                  {/* Drag handle */}
                  <div className="rank-drag-handle">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                  </div>

                  {/* Outfit preview */}
                  <div className="rank-outfit-preview">
                    {outfit.tryOnImage ? (
                      <img src={outfit.tryOnImage} alt="look" referrerPolicy="no-referrer" />
                    ) : outfit.products[0]?.imageUrl ? (
                      <img src={outfit.products[0].imageUrl} alt="look" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="rank-outfit-placeholder">?</div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="rank-outfit-info">
                    <span className="rank-outfit-name">{outfit.playerName || 'Outfit'}</span>
                    <span className="rank-outfit-details">
                      {outfit.products.length} items &middot; ${outfit.totalPrice?.toLocaleString()}
                    </span>
                  </div>

                  {/* Move buttons + expand */}
                  <div className="rank-actions">
                    <button
                      className="rank-move-btn"
                      onClick={() => moveRankItem(index, index - 1)}
                      disabled={index === 0}
                      title="Move up"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 15l-6-6-6 6" />
                      </svg>
                    </button>
                    <button
                      className="rank-move-btn"
                      onClick={() => moveRankItem(index, index + 1)}
                      disabled={index === rankedOutfits.length - 1}
                      title="Move down"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    <button
                      className="rank-expand-btn"
                      onClick={() => setExpandedRankItem(isExpanded ? null : outfit.outfitId)}
                      title="View items"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded item detail */}
                {isExpanded && (
                  <div className="rank-item-expanded">
                    {outfit.tryOnImage && (
                      <div className="rank-expanded-model">
                        <img src={outfit.tryOnImage} alt="full look" referrerPolicy="no-referrer" />
                      </div>
                    )}
                    <div className="rank-expanded-products">
                      {outfit.products.map(product => (
                        <div key={product.productSin} className="rank-expanded-product">
                          <img src={product.imageUrl} alt={product.name} referrerPolicy="no-referrer" />
                          <div className="rank-expanded-product-info">
                            <span className="rank-expanded-product-name">{product.name}</span>
                            <span className="rank-expanded-product-price">${product.price.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Submit */}
        <div className="ranking-submit">
          <button onClick={handleSubmitVotes} className="btn btn-primary">
            Submit Rankings
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // ── STAR MODE UI (original) ──
  return (
    <div className="voting-container">
      {/* Header */}
      <header className="voting-header">
        <div className="voting-header-label">Round Complete</div>
        <h1>Rate the Looks</h1>
        <div className="voting-progress">
          {ratedCount} of {totalOutfits} looks rated
        </div>
        <div className="voting-progress-bar">
          <div
            className="voting-progress-bar-fill"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        {timeLeft !== null && timeLeft > 0 && (
          <button onClick={handleGoBack} className="voting-go-back-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Go Back & Edit ({Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')} left)
          </button>
        )}
      </header>

      {/* Live Voting Tracker */}
      {voteStatus.total > 0 && (
        <div className="vote-tracker">
          <div className="vote-tracker-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{voteStatus.voted}/{voteStatus.total} Votes In</span>
          </div>
          <div className="vote-tracker-players">
            {voteStatus.players.map((p, i) => (
              <div key={i} className={`vote-tracker-player ${p.voted ? 'done' : ''}`}>
                <span className="vote-tracker-dot" />
                <span className="vote-tracker-name">{p.name}</span>
                {p.voted ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span className="vote-tracker-pending">voting...</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="error-message" style={{ maxWidth: '600px', margin: '0 auto 24px' }}>
          {error}
        </div>
      )}

      {/* Outfit Display */}
      <div className={`voting-outfit-display ${revealing ? 'outfit-revealing' : 'outfit-revealed'}`}>
        <div className={`voting-look-layout ${currentOutfit.tryOnImage ? 'has-model' : ''}`}>
          {/* Main Image — AI generated or product grid fallback */}
          <div className="voting-main-image">
            {currentOutfit.tryOnImage ? (
              <img
                src={currentOutfit.tryOnImage}
                alt={`${currentOutfit.playerName}'s look`}
                className="voting-model-img"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="voting-outfit-grid">
                {currentOutfit.products.map((product) => (
                  <div key={product.productSin} className="voting-outfit-item">
                    <img src={product.imageUrl} alt={product.name} referrerPolicy="no-referrer" />
                    <div className="voting-outfit-item-label">{product.category}</div>
                  </div>
                ))}
                {currentOutfit.products.length < 4 && (
                  <div className="voting-outfit-item voting-add-more">+</div>
                )}
              </div>
            )}
          </div>

          {/* Side Items Panel — visible when AI image exists */}
          {currentOutfit.tryOnImage && (
            <div className="voting-side-items">
              <div className="voting-side-items-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
                {currentOutfit.products.length} Items
              </div>
              <div className="voting-side-items-list">
                {currentOutfit.products.map((product) => (
                  <div key={product.productSin} className="voting-side-item">
                    <img src={product.imageUrl} alt={product.name} referrerPolicy="no-referrer" />
                    <div className="voting-side-item-info">
                      <span className="voting-side-item-name">{product.name}</span>
                      <span className="voting-side-item-cat">{product.category}</span>
                      <span className="voting-side-item-price">${product.price.toLocaleString()}</span>
                    </div>
                    {product.productUrl && (
                      <a href={product.productUrl} target="_blank" rel="noopener noreferrer" className="items-shop-link" title="Shop on Shopbop">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                        </svg>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Player Info */}
        <div className="voting-player-info">
          <div className="voting-player-name">{currentOutfit.playerName}</div>
          <div className="voting-player-stats">
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
              {currentOutfit.products.length} items
            </span>
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              ${currentOutfit.totalPrice.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Star Rating */}
        <div className="star-rating">
          <div className="star-rating-label">Your Rating</div>
          <div className="star-rating-stars">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={`star-rating-star ${
                  (hoveredStar !== null ? star <= hoveredStar : star <= (ratings[currentOutfit.outfitId] || 0))
                    ? 'active'
                    : ''
                }`}
                onClick={() => handleRating(currentOutfit.outfitId, star)}
                onMouseEnter={() => setHoveredStar(star)}
                onMouseLeave={() => setHoveredStar(null)}
              >
                ★
              </span>
            ))}
          </div>
          {ratings[currentOutfit.outfitId] && (
            <div className="star-rating-value">
              {ratings[currentOutfit.outfitId]} Star{ratings[currentOutfit.outfitId] > 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="voting-navigation">
          <button
            className="voting-nav-btn"
            onClick={handlePrev}
            disabled={currentIndex === 0}
          >
            ←
          </button>

          {ratedCount === totalOutfits ? (
            <button onClick={handleSubmitVotes} className="btn btn-primary">
              Submit All Ratings
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
              {currentIndex + 1} / {totalOutfits}
            </span>
          )}

          <button
            className="voting-nav-btn"
            onClick={handleNext}
            disabled={currentIndex === totalOutfits - 1}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}

export default Voting;
