import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { historyApi } from '../services/api';

function HallOfFame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') === 'popular' ? 'popular' : 'winners');
  const [gameHistory, setGameHistory] = useState([]);
  const [popularProducts, setPopularProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      historyApi.getHistory().then(r => r.data.history || []).catch(() => []),
      historyApi.getPopularProducts(24).then(r => r.data.products || []).catch(() => []),
    ]).then(([history, products]) => {
      setGameHistory(history);
      setPopularProducts(products);
      setLoading(false);
    });
  }, []);

  return (
    <div className="hof-container">
      {/* Header */}
      <div className="hof-header">
        <button className="hof-back-btn" onClick={() => navigate(-1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back
        </button>
        <div className="hof-title-block">
          <h1 className="hof-title">Hall of Fame</h1>
          <p className="hof-subtitle">Past winners &amp; trending picks from all games</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="hof-tabs">
        <button
          className={`hof-tab ${tab === 'winners' ? 'active' : ''}`}
          onClick={() => setTab('winners')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          Past Winners
          {gameHistory.length > 0 && <span className="hof-tab-count">{gameHistory.length}</span>}
        </button>
        <button
          className={`hof-tab ${tab === 'popular' ? 'active' : ''}`}
          onClick={() => setTab('popular')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
          Popular Clothes
          {popularProducts.length > 0 && <span className="hof-tab-count">{popularProducts.length}</span>}
        </button>
      </div>

      {/* Content */}
      <div className="hof-content">
        {loading ? (
          <div className="hof-loading">
            <div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.15)', borderTopColor: 'var(--primary-orange)' }} />
            <p>Loading...</p>
          </div>
        ) : tab === 'winners' ? (
          gameHistory.length === 0 ? (
            <div className="hof-empty">
              <span className="hof-empty-icon">🏆</span>
              <p>No completed games yet.</p>
              <p className="hof-empty-sub">Play a game to see winners here!</p>
              <button className="btn btn-primary" onClick={() => navigate('/create')}>
                Start a Game
              </button>
            </div>
          ) : (
            <div className="hof-winners-list">
              {gameHistory.map((entry, i) => (
                <div
                  key={entry.gameId}
                  className="hof-winner-card"
                  onClick={() => navigate(`/results/${entry.gameId}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigate(`/results/${entry.gameId}`)}
                >
                  <div className="hof-winner-rank">#{i + 1}</div>
                  {entry.winner?.previewImage ? (
                    <img
                      src={entry.winner.previewImage}
                      alt={entry.winner.username}
                      className="hof-winner-img"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="hof-winner-img hof-winner-img-placeholder">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M3 9l4-4 4 4 4-4 4 4" />
                      </svg>
                    </div>
                  )}
                  <div className="hof-winner-info">
                    <span className="hof-winner-theme">{entry.themeName}</span>
                    <span className="hof-winner-name">
                      <span className="hof-crown">👑</span>
                      {entry.winner?.username || 'No winner recorded'}
                      {entry.winner && (
                        <span className="hof-winner-score">{entry.winner.score.toFixed(1)}★</span>
                      )}
                    </span>
                    <span className="hof-winner-meta">
                      {entry.playerCount} player{entry.playerCount !== 1 ? 's' : ''}
                      {entry.createdAt && ` · ${new Date(entry.createdAt).toLocaleDateString()}`}
                    </span>
                  </div>
                  <div className="hof-winner-cta">
                    View Results
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          popularProducts.length === 0 ? (
            <div className="hof-empty">
              <span className="hof-empty-icon">👗</span>
              <p>No data yet.</p>
              <p className="hof-empty-sub">Play some games to see trending items!</p>
              <button className="btn btn-primary" onClick={() => navigate('/create')}>
                Start a Game
              </button>
            </div>
          ) : (
            <div className="hof-products-grid">
              {popularProducts.map((product, i) => (
                <div key={product.id} className="hof-product-card">
                  <div className="hof-product-img-wrap">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="hof-product-img"
                      referrerPolicy="no-referrer"
                    />
                    <span className="hof-product-rank">#{i + 1}</span>
                    <span className="hof-product-badge">{product.pickCount}x picked</span>
                  </div>
                  <div className="hof-product-info">
                    <span className="hof-product-name">{product.name}</span>
                    {product.brand && <span className="hof-product-brand">{product.brand}</span>}
                    {product.price != null && (
                      <span className="hof-product-price">${product.price.toLocaleString()}</span>
                    )}
                  </div>
                  {product.productUrl && (
                    <a
                      href={product.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hof-product-shop-btn"
                      onClick={e => e.stopPropagation()}
                    >
                      Shop on Shopbop
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                      </svg>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default HallOfFame;
