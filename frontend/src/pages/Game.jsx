import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productApi, outfitApi } from '../services/api';
import useGameStore from '../store/gameStore';

// Mock products for development
const mockProducts = [
  { productSin: 'P001', name: 'Silk Evening Gown', category: 'Dresses', brand: 'Marchesa', price: 1250, imageUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400' },
  { productSin: 'P002', name: 'Luxe Leather Sneakers', category: 'Shoes', brand: 'Golden Goose', price: 450, imageUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400' },
  { productSin: 'P003', name: 'Crocodile Pattern Bag', category: 'Accessories', brand: 'Staud', price: 890, imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400' },
  { productSin: 'P004', name: 'Oversized Blazer', category: 'Outerwear', brand: 'The Row', price: 2100, imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400' },
  { productSin: 'P005', name: 'Statement Earrings', category: 'Jewelry', brand: 'Jennifer Behr', price: 425, imageUrl: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400' },
  { productSin: 'P006', name: 'Cashmere Sweater', category: 'Tops', brand: 'Nili Lotan', price: 695, imageUrl: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400' },
  { productSin: 'P007', name: 'Wide Leg Trousers', category: 'Bottoms', brand: 'Vince', price: 385, imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400' },
  { productSin: 'P008', name: 'Strappy Heels', category: 'Shoes', brand: 'Aquazzura', price: 750, imageUrl: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400' },
];

function Game() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const {
    game,
    currentOutfit,
    addProductToOutfit,
    removeProductFromOutfit,
    setLoading,
    setError,
    error,
  } = useGameStore();

  const [timeRemaining, setTimeRemaining] = useState(game?.timeLimit || 300);
  const [products, setProducts] = useState(mockProducts);
  const [selectedProducts, setSelectedProducts] = useState(new Set());

  const budget = game?.budget || 5000;
  const theme = game?.theme || 'Runway Ready';

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleTimeUp = async () => {
    await handleSubmitOutfit();
  };

  const handleProductClick = (product) => {
    if (selectedProducts.has(product.productSin)) {
      // Remove from outfit
      setSelectedProducts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(product.productSin);
        return newSet;
      });
      removeProductFromOutfit(product.productSin);
    } else {
      // Add to outfit
      const success = addProductToOutfit(product);
      if (success) {
        setSelectedProducts((prev) => new Set([...prev, product.productSin]));
      }
    }
  };

  const handleSubmitOutfit = async () => {
    if (currentOutfit.products.length === 0) {
      setError('Please add at least one item to your outfit');
      return;
    }

    setLoading(true);
    try {
      console.log('Submitting outfit:', currentOutfit);
      navigate(`/voting/${gameId}`);
    } catch (error) {
      setError('Failed to submit outfit');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const budgetRemaining = budget - currentOutfit.totalPrice;
  const budgetPercentage = (currentOutfit.totalPrice / budget) * 100;

  return (
    <div className="game-container">
      {/* Header */}
      <header className="game-header">
        <div className="game-brand">
          <span className="game-brand-title">Style Showdown</span>
          <span className="game-brand-subtitle">Presented by Shopbop</span>
        </div>

        <div className="game-theme-display">
          <span className="game-theme-label">Active Theme</span>
          <span className="game-theme-value">{theme}</span>
        </div>

        <div className="game-wallet">
          <span className="game-wallet-label">Wallet</span>
          <span className="game-wallet-value">${budgetRemaining.toLocaleString()}</span>
        </div>
      </header>

      {/* Timer Overlay (shows when low) */}
      {timeRemaining <= 30 && (
        <div className="game-timer warning">{timeRemaining}</div>
      )}

      <div className="game-content">
        {/* Products Panel */}
        <main className="products-panel">
          <div className="products-header">
            <h2>Curated Pieces for {theme}</h2>
            <p>Click items to add them to your board. Time remaining: {formatTime(timeRemaining)}</p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="products-grid">
            {products.map((product) => (
              <div
                key={product.productSin}
                className={`product-card ${selectedProducts.has(product.productSin) ? 'selected' : ''}`}
                onClick={() => handleProductClick(product)}
              >
                <div className="product-image-container">
                  <img src={product.imageUrl} alt={product.name} />
                  {selectedProducts.has(product.productSin) && (
                    <div className="product-check">✓</div>
                  )}
                </div>
                <div className="product-info">
                  <span className="product-category">{product.category}</span>
                  <span className="product-name">{product.name}</span>
                  <span className="product-price">${product.price.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* The Board (Outfit Panel) */}
        <aside className="outfit-panel">
          <div className="outfit-panel-header">
            <h3>The Board</h3>
            <span className="outfit-panel-subtitle">Visualizing Your Edit</span>
          </div>

          <div className="outfit-items">
            <div className="outfit-items-grid">
              {currentOutfit.products.map((product) => (
                <div key={product.productSin} className="outfit-item">
                  <img src={product.imageUrl} alt={product.name} />
                  <span className="outfit-item-label">{product.category}</span>
                  <button
                    className="outfit-item-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProductClick(product);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {/* Empty slots */}
              {[...Array(Math.max(0, 4 - currentOutfit.products.length))].map((_, i) => (
                <div key={`empty-${i}`} className="outfit-item outfit-empty-slot">
                  +
                </div>
              ))}
            </div>
          </div>

          <div className="outfit-panel-footer">
            <div className="budget-used">
              <span className="budget-used-label">Budget Used</span>
              <span className="budget-used-value">${currentOutfit.totalPrice.toLocaleString()}</span>
            </div>
            <div className="budget-bar">
              <div
                className="budget-bar-fill"
                style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
              />
            </div>
            <button
              onClick={handleSubmitOutfit}
              className="btn btn-primary"
              disabled={currentOutfit.products.length === 0}
            >
              Submit Look
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default Game;
