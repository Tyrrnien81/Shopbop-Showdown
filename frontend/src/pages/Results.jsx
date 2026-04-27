import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { voteApi, gameApi } from '../services/api';
import useGameStore from '../store/gameStore';
import socketService from '../services/socket';

// Mock results for development
const mockResults = [
  {
    rank: 1,
    outfitId: 'OUT001',
    username: 'FashionQueen',
    score: 4.8,
    totalVotes: 5,
    products: [
      { productSin: 'P001', name: 'Silk Evening Gown', category: 'Dresses', price: 1250, imageUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400' },
      { productSin: 'P002', name: 'Strappy Heels', category: 'Shoes', price: 750, imageUrl: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400' },
      { productSin: 'P003', name: 'Statement Earrings', category: 'Jewelry', price: 425, imageUrl: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400' },
    ],
    totalPrice: 2425,
  },
  {
    rank: 2,
    outfitId: 'OUT002',
    username: 'StyleGuru',
    score: 4.2,
    totalVotes: 5,
    products: [
      { productSin: 'P004', name: 'Oversized Blazer', category: 'Outerwear', price: 2100, imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400' },
      { productSin: 'P005', name: 'Wide Leg Trousers', category: 'Bottoms', price: 385, imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400' },
    ],
    totalPrice: 2485,
  },
  {
    rank: 3,
    outfitId: 'OUT003',
    username: 'TrendSetter',
    score: 3.6,
    totalVotes: 5,
    products: [
      { productSin: 'P006', name: 'Cashmere Sweater', category: 'Tops', price: 695, imageUrl: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400' },
      { productSin: 'P007', name: 'Crocodile Pattern Bag', category: 'Accessories', price: 890, imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400' },
      { productSin: 'P008', name: 'Luxe Leather Sneakers', category: 'Shoes', price: 450, imageUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400' },
    ],
    totalPrice: 2035,
  },
];

// Reveal phases: drumroll → 3rd → 2nd → 1st → full
const PHASE_DRUMROLL = 0;
const PHASE_THIRD = 1;
const PHASE_SECOND = 2;
const PHASE_FIRST = 3;
const PHASE_FULL = 4;

function Results() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { results, setResults, resetGame, isSinglePlayer, game } = useGameStore();
  const votingMode = game?.votingMode || 'star';
  const [isLoading, setIsLoadingLocal] = useState(true);
  const [expandedItems, setExpandedItems] = useState({});
  const [revealPhase, setRevealPhase] = useState(PHASE_DRUMROLL);
  const confettiRef = useRef(null);
  const revealTimers = useRef([]);

  const toggleItems = (outfitId) => {
    setExpandedItems(prev => ({ ...prev, [outfitId]: !prev[outfitId] }));
  };

  const launchConfetti = useCallback(() => {
    const container = confettiRef.current;
    if (!container) return;
    container.innerHTML = '';
    const colors = ['#EE4A1B', '#FFD700', '#FF6B6B', '#4ECDC4', '#A855F7', '#F472B6', '#FBBF24', '#34D399'];
    const shapes = ['circle', 'square', 'strip'];
    for (let i = 0; i < 120; i++) {
      const piece = document.createElement('div');
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const left = Math.random() * 100;
      const delay = Math.random() * 0.6;
      const duration = 2.5 + Math.random() * 2;
      const drift = (Math.random() - 0.5) * 200;
      const spin = Math.random() * 720 - 360;

      piece.className = `confetti-piece confetti-${shape}`;
      piece.style.cssText = `
        left: ${left}%;
        background: ${color};
        animation-delay: ${delay}s;
        animation-duration: ${duration}s;
        --drift: ${drift}px;
        --spin: ${spin}deg;
      `;
      container.appendChild(piece);
    }
    setTimeout(() => { if (container) container.innerHTML = ''; }, 4500);
  }, []);

  const startRevealSequence = useCallback((data) => {
    // Clear any existing timers
    revealTimers.current.forEach(t => clearTimeout(t));
    revealTimers.current = [];

    const count = data.length;

    if (count <= 1) {
      // Single player or single result — skip dramatic reveal
      setRevealPhase(PHASE_FULL);
      setTimeout(() => launchConfetti(), 300);
      return;
    }

    // Drumroll phase
    setRevealPhase(PHASE_DRUMROLL);

    // Reveal 3rd (or last place) after 1.5s
    const t1 = setTimeout(() => {
      setRevealPhase(PHASE_THIRD);
    }, 1500);

    // Reveal 2nd after 3.5s
    const t2 = setTimeout(() => {
      setRevealPhase(PHASE_SECOND);
    }, 3500);

    // Reveal 1st after 5.5s + confetti
    const t3 = setTimeout(() => {
      setRevealPhase(PHASE_FIRST);
      setTimeout(() => launchConfetti(), 400);
    }, 5500);

    // Show full results (actions, rest of list) after 7.5s
    const t4 = setTimeout(() => {
      setRevealPhase(PHASE_FULL);
    }, 7500);

    revealTimers.current = [t1, t2, t3, t4];
  }, [launchConfetti]);

  // Recover game data on reload so votingMode is available
  useEffect(() => {
    if (!game) {
      gameApi.getGame(gameId).then(res => {
        const g = res.data.game || res.data;
        if (g) useGameStore.getState().setGame(g);
      }).catch(() => {});
    }
  }, [gameId, game]);

  useEffect(() => {
    socketService.disconnect();
  }, []);

  useEffect(() => {
    fetchResults();
    return () => {
      revealTimers.current.forEach(t => clearTimeout(t));
    };
  }, [gameId]);

  const fetchResults = async () => {
    setIsLoadingLocal(true);
    try {
      const response = await voteApi.getResults(gameId);
      const fetched = response.data.results || [];
      const data = fetched.length > 0 ? fetched : mockResults;
      setResults(data);
      setIsLoadingLocal(false);
      startRevealSequence(data);
    } catch {
      setResults(mockResults);
      setIsLoadingLocal(false);
      startRevealSequence(mockResults);
    }
  };

  const skipReveal = () => {
    revealTimers.current.forEach(t => clearTimeout(t));
    revealTimers.current = [];
    setRevealPhase(PHASE_FULL);
    launchConfetti();
  };

  const handlePlayAgain = () => {
    resetGame();
    navigate('/');
  };

  const handleShareResults = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Style Showdown Results',
        text: `Check out who won the fashion competition!`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  if (isLoading) {
    return (
      <div className="results-container">
        <div className="loading" style={{ color: 'white' }}>
          <div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'var(--primary-orange)' }}></div>
          <p>Calculating results...</p>
        </div>
      </div>
    );
  }

  const displayResults = results.length > 0 ? results : mockResults;
  const topThree = displayResults.slice(0, 3);
  const restOfResults = displayResults.slice(3);

  // Drumroll screen
  if (revealPhase === PHASE_DRUMROLL) {
    return (
      <div className="results-container">
        <div className="reveal-drumroll">
          <div className="reveal-drumroll-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <h1 className="reveal-drumroll-title">And the results are...</h1>
          <div className="reveal-drumroll-dots">
            <span className="reveal-dot">.</span>
            <span className="reveal-dot">.</span>
            <span className="reveal-dot">.</span>
          </div>
          <button className="reveal-skip-btn" onClick={skipReveal}>
            Skip Reveal
          </button>
        </div>
      </div>
    );
  }

  // Determine which places to show based on phase
  const showThird = revealPhase >= PHASE_THIRD && topThree.length >= 3;
  const showSecond = revealPhase >= PHASE_SECOND && topThree.length >= 2;
  const showFirst = revealPhase >= PHASE_FIRST;
  const showFull = revealPhase >= PHASE_FULL;

  return (
    <div className="results-container">
      {/* Confetti */}
      <div className="confetti-container" ref={confettiRef} />

      {/* Header */}
      <header className="results-header">
        <h1>{isSinglePlayer ? 'Your Look' : 'The Results Are In'}</h1>
      </header>

      {/* Skip button during reveal */}
      {!showFull && (
        <button className="reveal-skip-btn reveal-skip-corner" onClick={skipReveal}>
          Skip
        </button>
      )}

      {/* Winner Podium */}
      <div className="winner-podium">
        {topThree.map((result, index) => {
          const placeClass = index === 0 ? 'first' : index === 1 ? 'second' : 'third';
          const emoji = index === 0 ? '👑' : index === 1 ? '🥈' : '🥉';
          const isExpanded = expandedItems[result.outfitId];

          // Should this place be visible?
          const isVisible =
            (index === 0 && showFirst) ||
            (index === 1 && showSecond) ||
            (index === 2 && showThird);

          // Is this the one currently being revealed?
          const isRevealing =
            (index === 2 && revealPhase === PHASE_THIRD) ||
            (index === 1 && revealPhase === PHASE_SECOND) ||
            (index === 0 && revealPhase === PHASE_FIRST);

          return (
            <div
              key={result.outfitId}
              className={`podium-place ${placeClass} ${isVisible ? 'podium-visible' : 'podium-hidden'} ${isRevealing ? 'podium-revealing' : ''}`}
            >
              {/* Main Image */}
              <div className="podium-outfit">
                {result.tryOnImage ? (
                  <img
                    src={result.tryOnImage}
                    alt={`${result.username}'s look`}
                    className="podium-model-img"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="podium-outfit-grid">
                    {result.products.slice(0, 4).map((product) => (
                      <div key={product.productSin} className="podium-outfit-item">
                        <img src={product.imageUrl} alt={product.name} referrerPolicy="no-referrer" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* View Items Toggle */}
              <button
                className={`view-items-btn ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleItems(result.outfitId)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
                {isExpanded ? 'Hide Items' : `${result.products.length} Items`}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {/* Items Dropdown */}
              {isExpanded && (
                <div className="items-dropdown">
                  {result.products.map((product) => (
                    <div key={product.productSin} className="items-dropdown-item">
                      <img src={product.imageUrl} alt={product.name} referrerPolicy="no-referrer" />
                      <div className="items-dropdown-info">
                        <span className="items-dropdown-name">{product.name}</span>
                        <span className="items-dropdown-price">${product.price.toLocaleString()}</span>
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
              )}

              {/* Rank Emoji */}
              <div className="podium-rank">{emoji}</div>

              {/* Player Info */}
              <div className="podium-player-name">{result.username}</div>
              <div className="podium-score">
                {votingMode === 'ranking' ? (
                  <><span className="star">#</span><span>{result.score.toFixed(1)}</span></>
                ) : (
                  <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <span key={star} style={{ fontSize: '1rem', color: star <= Math.round(result.score) ? 'var(--star-gold)' : 'rgba(255,255,255,0.2)' }}>★</span>
                    ))}
                    <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginLeft: '4px' }}>{result.score.toFixed(1)}</span>
                  </div>
                )}
              </div>

              {/* Podium Bar */}
              <div className="podium-bar">
                {result.rank}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reveal label during sequential reveal */}
      {!showFull && revealPhase >= PHASE_THIRD && (
        <div className="reveal-place-label">
          {revealPhase === PHASE_THIRD && '3rd Place'}
          {revealPhase === PHASE_SECOND && '2nd Place'}
          {revealPhase === PHASE_FIRST && '1st Place!'}
        </div>
      )}

      {/* Rest of Results — only after full reveal */}
      {showFull && restOfResults.length > 0 && (
        <div className="results-rest results-rest-reveal">
          <h3>Other Submissions</h3>
          {restOfResults.map((result) => {
            const isExpanded = expandedItems[result.outfitId];
            return (
              <div key={result.outfitId} className="result-item-wrapper">
                <div className="result-item">
                  <div className="result-rank">#{result.rank}</div>
                  <div className="result-outfit-preview">
                    {result.tryOnImage ? (
                      <img
                        src={result.tryOnImage}
                        alt={`${result.username}'s look`}
                        style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px' }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      result.products.slice(0, 4).map((product) => (
                        <img key={product.productSin} src={product.imageUrl} alt={product.name} referrerPolicy="no-referrer" />
                      ))
                    )}
                  </div>
                  <div className="result-info">
                    <div className="result-player-name">{result.username}</div>
                    <div className="result-item-count">{result.products.length} items</div>
                  </div>
                  <div className="result-score">
                    {votingMode === 'ranking' ? (
                      <><span>#</span><span>{result.score.toFixed(1)}</span></>
                    ) : (
                      <>
                        {[1, 2, 3, 4, 5].map(star => (
                          <span key={star} style={{ fontSize: '0.85rem', color: star <= Math.round(result.score) ? 'var(--star-gold)' : 'rgba(255,255,255,0.2)' }}>★</span>
                        ))}
                        <span style={{ fontSize: '0.8rem', marginLeft: '2px' }}>{result.score.toFixed(1)}</span>
                      </>
                    )}
                  </div>
                  <button className="view-items-btn-sm" onClick={() => toggleItems(result.outfitId)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                </div>
                {isExpanded && (
                  <div className="items-dropdown items-dropdown-horizontal">
                    {result.products.map((product) => (
                      <div key={product.productSin} className="items-dropdown-item">
                        <img src={product.imageUrl} alt={product.name} referrerPolicy="no-referrer" />
                        <div className="items-dropdown-info">
                          <span className="items-dropdown-name">{product.name}</span>
                          <span className="items-dropdown-price">${product.price.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Actions — only after full reveal */}
      {showFull && (
        <div className="results-actions results-actions-reveal">
          <button onClick={handleShareResults} className="btn btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share Results
          </button>
          <button onClick={handlePlayAgain} className="btn btn-primary">
            Play Again
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
          <button onClick={() => navigate('/hall-of-fame?tab=winners')} className="btn btn-past-winners">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            Past Winners
          </button>
        </div>
      )}
    </div>
  );
}

export default Results;
