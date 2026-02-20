import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { outfitApi, voteApi } from '../services/api';
import useGameStore from '../store/gameStore';

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
    outfits,
    setOutfits,
    hasVoted,
    setHasVoted,
    setLoading,
    setError,
    error,
  } = useGameStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [ratings, setRatings] = useState({});
  const [votingComplete, setVotingComplete] = useState(false);
  const [hoveredStar, setHoveredStar] = useState(null);

  useEffect(() => {
    fetchOutfits();
  }, [gameId]);

  const fetchOutfits = async () => {
    setLoading(true);
    try {
      // Mock outfits for development
      setOutfits(mockOutfits);
    } catch (error) {
      setError('Failed to load outfits');
    } finally {
      setLoading(false);
    }
  };

  const currentOutfit = outfits[currentIndex] || mockOutfits[currentIndex];
  const totalOutfits = outfits.length || mockOutfits.length;
  const ratedCount = Object.keys(ratings).length;
  const progressPercentage = (ratedCount / totalOutfits) * 100;

  const handleRating = (outfitId, rating) => {
    setRatings((prev) => ({
      ...prev,
      [outfitId]: rating,
    }));
  };

  const handleNext = () => {
    if (currentIndex < totalOutfits - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSubmitVotes = async () => {
    if (ratedCount < totalOutfits) {
      setError('Please rate all outfits before submitting');
      return;
    }

    setLoading(true);
    try {
      console.log('Submitting votes:', ratings);
      setHasVoted(true);

      // Simulate waiting for all votes
      setTimeout(() => {
        setVotingComplete(true);
      }, 2000);
    } catch (error) {
      setError('Failed to submit votes');
    } finally {
      setLoading(false);
    }
  };

  const handleViewResults = () => {
    navigate(`/results/${gameId}`);
  };

  if (hasVoted && !votingComplete) {
    return (
      <div className="voting-container">
        <div className="loading" style={{ color: 'white' }}>
          <div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'var(--primary-orange)' }}></div>
          <h2>Vote Submitted!</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>Waiting for other players to vote...</p>
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

  if (!currentOutfit) {
    return (
      <div className="voting-container">
        <div className="loading" style={{ color: 'white' }}>
          <div className="spinner"></div>
          <p>Loading outfits...</p>
        </div>
      </div>
    );
  }

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
      </header>

      {error && (
        <div className="error-message" style={{ maxWidth: '600px', margin: '0 auto 24px' }}>
          {error}
        </div>
      )}

      {/* Outfit Display */}
      <div className="voting-outfit-display">
        <div className="voting-outfit-grid">
          {currentOutfit.products.map((product) => (
            <div key={product.productSin} className="voting-outfit-item">
              <img src={product.imageUrl} alt={product.name} />
              <div className="voting-outfit-item-label">{product.category}</div>
            </div>
          ))}
          {currentOutfit.products.length < 4 && (
            <div className="voting-outfit-item voting-add-more">+</div>
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
