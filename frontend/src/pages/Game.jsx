import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { generateTryOnImage, generateSingleTryOnImage } from '../services/geminiApi';
import { productApi, outfitApi } from '../services/api';
import useGameStore from '../store/gameStore';

// Outfit validation rules - Dresses are mutually exclusive with Tops/Bottoms
const MUTUALLY_EXCLUSIVE = [
  ['Dresses', 'Tops'],
  ['Dresses', 'Bottoms'],
];

function Game() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const {
    game,
    currentOutfit,
    userPhoto,
    addProductToOutfit,
    removeProductFromOutfit,
    setLoading,
    setError,
    error,
  } = useGameStore();

  const [timeRemaining, setTimeRemaining] = useState(game?.timeLimit || 300);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [validationErrors, setValidationErrors] = useState([]);

  // Virtual try-on modal state
  const [showModal, setShowModal] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([null, null, null]); // 3 slots
  const [loadingImages, setLoadingImages] = useState([false, false, false]); // Loading state per image
  const [selectedImage, setSelectedImage] = useState(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generationError, setGenerationError] = useState(null);

  const budget = game?.budget || 5000;
  const theme = game?.theme || 'Runway Ready';

  // Load products from ShopBop catalog on mount
  useEffect(() => {
    const CATEGORIES_TO_FETCH = ['Dresses', 'Tops', 'Bottoms', 'Shoes', 'Jewelry', 'Outerwear', 'Accessories'];

    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        // Fetch 4-5 items per category in parallel for variety
        const results = await Promise.all(
          CATEGORIES_TO_FETCH.map(cat =>
            productApi.searchProducts({ category: cat, limit: 5, theme })
              .then(r => r.data.products || [])
              .catch(() => [])
          )
        );
        const all = results.flat().filter(p => p.productSin && p.name && p.imageUrl);
        setProducts(all);
      } catch (err) {
        console.error('Failed to load products:', err);
        setError('Could not load products from ShopBop');
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchProducts();
  }, [theme]);

  // Get categories in current outfit
  const getOutfitCategories = useCallback(() => {
    const categories = new Set();
    currentOutfit.products.forEach(p => categories.add(p.category));
    return categories;
  }, [currentOutfit.products]);

  // Check if adding a product would violate mutual exclusion rules
  const wouldViolateMutualExclusion = useCallback((product) => {
    const currentCategories = getOutfitCategories();

    for (const [cat1, cat2] of MUTUALLY_EXCLUSIVE) {
      if (product.category === cat1 && currentCategories.has(cat2)) {
        return `Cannot add ${product.category} when you have ${cat2} selected`;
      }
      if (product.category === cat2 && currentCategories.has(cat1)) {
        return `Cannot add ${product.category} when you have ${cat1} selected`;
      }
    }
    return null;
  }, [getOutfitCategories]);

  // Validate outfit completeness
  const validateOutfit = useCallback(() => {
    const errors = [];
    const categories = getOutfitCategories();

    // Check for shoes
    if (!categories.has('Shoes')) {
      errors.push('Missing: Shoes');
    }

    // Check for jewelry
    if (!categories.has('Jewelry')) {
      errors.push('Missing: Jewelry');
    }

    // Check for body coverage - either dress OR (tops + bottoms)
    const hasDress = categories.has('Dresses');
    const hasTops = categories.has('Tops');
    const hasBottoms = categories.has('Bottoms');

    if (!hasDress && !(hasTops && hasBottoms)) {
      if (!hasDress && !hasTops && !hasBottoms) {
        errors.push('Missing: Dress OR Top + Bottoms');
      } else if (hasTops && !hasBottoms) {
        errors.push('Missing: Bottoms (or choose a Dress instead)');
      } else if (hasBottoms && !hasTops) {
        errors.push('Missing: Top (or choose a Dress instead)');
      }
    }

    return errors;
  }, [getOutfitCategories]);

  // Update validation errors when outfit changes
  useEffect(() => {
    setValidationErrors(validateOutfit());
  }, [currentOutfit.products, validateOutfit]);

  // Open modal (no generation)
  const handleOpenModal = () => {
    if (currentOutfit.products.length === 0) {
      setGenerationError('Please select items first');
      return;
    }
    setShowModal(true);
    setGenerationError(null);
  };

  // Generate all 3 images
  const handleGenerateAll = async () => {
    setIsGeneratingAll(true);
    setGenerationError(null);
    setLoadingImages([true, true, true]);
    setGeneratedImages([null, null, null]);
    setSelectedImage(null);

    try {
      const images = await generateTryOnImage(currentOutfit.products, userPhoto);
      // Convert to data URLs and fill slots
      const imageUrls = [null, null, null];
      images.forEach((img, i) => {
        if (i < 3) {
          imageUrls[i] = `data:${img.mimeType};base64,${img.imageData}`;
        }
      });
      setGeneratedImages(imageUrls);
    } catch (err) {
      console.error('Failed to generate try-on images:', err);
      setGenerationError(err.message || 'Failed to generate preview');
    } finally {
      setIsGeneratingAll(false);
      setLoadingImages([false, false, false]);
    }
  };

  // Regenerate a single image
  const handleRegenerateOne = async (index) => {
    if (currentOutfit.products.length === 0) return;

    // Set loading for this specific image
    setLoadingImages(prev => {
      const newState = [...prev];
      newState[index] = true;
      return newState;
    });

    try {
      const image = await generateSingleTryOnImage(currentOutfit.products, index, userPhoto);
      const imageUrl = `data:${image.mimeType};base64,${image.imageData}`;

      setGeneratedImages(prev => {
        const newImages = [...prev];
        newImages[index] = imageUrl;
        return newImages;
      });

      // If the regenerated image was selected, update selection
      if (selectedImage === generatedImages[index]) {
        setSelectedImage(imageUrl);
      }
    } catch (err) {
      console.error(`Failed to regenerate image ${index + 1}:`, err);
    } finally {
      setLoadingImages(prev => {
        const newState = [...prev];
        newState[index] = false;
        return newState;
      });
    }
  };

  // Close modal
  const handleCloseModal = () => {
    setShowModal(false);
  };

  // Select an image
  const handleSelectImage = (imageUrl) => {
    setSelectedImage(imageUrl);
  };

  // Confirm selection and close modal
  const handleConfirmSelection = () => {
    // Could save selectedImage to state/store if needed
    setShowModal(false);
  };

  const handleSubmitOutfit = useCallback(async () => {
    const errors = validateOutfit();
    if (errors.length > 0) {
      setError('Please complete your outfit: ' + errors.join(', '));
      return;
    }

    const { currentPlayer } = useGameStore.getState();

    setLoading(true);
    try {
      if (currentPlayer?.playerId) {
        await outfitApi.submitOutfit({
          gameId,
          playerId: currentPlayer.playerId,
          products: currentOutfit.products,
          totalPrice: currentOutfit.totalPrice,
        });
      }
      navigate(`/voting/${gameId}`);
    } catch {
      setError('Failed to submit outfit');
    } finally {
      setLoading(false);
    }
  }, [currentOutfit, gameId, navigate, setError, setLoading, validateOutfit]);

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitOutfit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [handleSubmitOutfit]);

  const handleProductClick = (product) => {
    if (selectedProducts.has(product.productSin)) {
      // Remove from outfit
      setSelectedProducts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(product.productSin);
        return newSet;
      });
      removeProductFromOutfit(product.productSin);
      // Clear selected image when outfit changes
      setSelectedImage(null);
    } else {
      // Check mutual exclusion before adding
      const violation = wouldViolateMutualExclusion(product);
      if (violation) {
        setError(violation);
        return;
      }

      // Add to outfit
      const success = addProductToOutfit(product);
      if (success) {
        setSelectedProducts((prev) => new Set([...prev, product.productSin]));
        // Clear selected image when outfit changes
        setSelectedImage(null);
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const budgetRemaining = budget - currentOutfit.totalPrice;
  const budgetPercentage = (currentOutfit.totalPrice / budget) * 100;
  const isOutfitComplete = validationErrors.length === 0 && currentOutfit.products.length > 0;

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

          {/* Category filter tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
            {['All', 'Dresses', 'Tops', 'Bottoms', 'Shoes', 'Jewelry', 'Outerwear', 'Accessories'].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  border: '1px solid var(--border-light)',
                  background: selectedCategory === cat ? 'var(--primary-orange)' : 'transparent',
                  color: selectedCategory === cat ? 'white' : 'var(--text-light)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  transition: 'all 0.2s',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {error && <div className="error-message">{error}</div>}

          {loadingProducts ? (
            <div className="loading" style={{ minHeight: '200px' }}>
              <div className="spinner"></div>
              <p>Loading ShopBop catalog...</p>
            </div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-light)', padding: '40px' }}>
              <p>No products found. Check that the backend is running.</p>
            </div>
          ) : null}

          <div className="products-grid">
            {products
              .filter(p => selectedCategory === 'All' || p.category === selectedCategory)
              .map((product) => (
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

        {/* The Board (Outfit Panel) - Always show Pinterest board */}
        <aside className="outfit-panel">
          <div className="outfit-panel-header">
            <h3>The Board</h3>
            <span className="outfit-panel-subtitle">Your Curated Look</span>
          </div>

          {/* Outfit Requirements Checklist */}
          <div className="outfit-requirements">
            <div className={`requirement ${getOutfitCategories().has('Dresses') || (getOutfitCategories().has('Tops') && getOutfitCategories().has('Bottoms')) ? 'met' : ''}`}>
              {getOutfitCategories().has('Dresses') ? '✓ Dress' : getOutfitCategories().has('Tops') && getOutfitCategories().has('Bottoms') ? '✓ Top + Bottoms' : '○ Dress OR Top + Bottoms'}
            </div>
            <div className={`requirement ${getOutfitCategories().has('Shoes') ? 'met' : ''}`}>
              {getOutfitCategories().has('Shoes') ? '✓ Shoes' : '○ Shoes'}
            </div>
            <div className={`requirement ${getOutfitCategories().has('Jewelry') ? 'met' : ''}`}>
              {getOutfitCategories().has('Jewelry') ? '✓ Jewelry' : '○ Jewelry'}
            </div>
          </div>

          {/* Pinterest-style outfit board */}
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

          {/* Generate Try-On Button */}
          <div className="tryon-section">
            <button
              onClick={handleOpenModal}
              className="btn btn-secondary generate-btn"
              disabled={currentOutfit.products.length === 0}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              See it on a Model
            </button>
            {selectedImage && (
              <div className="selected-preview">
                <img src={selectedImage} alt="Selected look" />
              </div>
            )}
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
              disabled={!isOutfitComplete}
            >
              {isOutfitComplete ? 'Submit Look' : 'Complete Outfit First'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </aside>
      </div>

      {/* Try-On Modal */}
      {showModal && (
        <div className="tryon-modal-overlay" onClick={handleCloseModal}>
          <div className="tryon-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tryon-modal-header">
              <h2>Choose Your Look</h2>
              <p>Select your favorite AI-generated outfit preview</p>
              <button className="modal-close-btn" onClick={handleCloseModal}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="tryon-modal-content">
              {generationError && !generatedImages.some(img => img) ? (
                <div className="tryon-modal-error">
                  <p>{generationError}</p>
                  <button onClick={handleGenerateAll} className="btn btn-secondary">
                    Try Again
                  </button>
                </div>
              ) : !generatedImages.some(img => img) && !isGeneratingAll && !loadingImages.some(l => l) ? (
                <div className="tryon-modal-empty">
                  <div className="tryon-empty-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                  <h3>Ready to Generate</h3>
                  <p>Click the button below to create 3 AI-generated outfit previews</p>
                  <button onClick={handleGenerateAll} className="btn btn-primary generate-looks-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                    Generate Looks
                  </button>
                </div>
              ) : (
                <div className="tryon-images-grid">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      className={`tryon-image-option ${selectedImage === generatedImages[index] && generatedImages[index] ? 'selected' : ''} ${loadingImages[index] ? 'loading' : ''}`}
                      onClick={() => generatedImages[index] && !loadingImages[index] && handleSelectImage(generatedImages[index])}
                    >
                      {loadingImages[index] ? (
                        <div className="tryon-image-loading">
                          <div className="spinner"></div>
                          <span>Generating...</span>
                        </div>
                      ) : generatedImages[index] ? (
                        <>
                          <img src={generatedImages[index]} alt={`Look ${index + 1}`} />
                          <button
                            className="tryon-refresh-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRegenerateOne(index);
                            }}
                            title="Regenerate this look"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
                            </svg>
                          </button>
                        </>
                      ) : (
                        <div className="tryon-image-empty">
                          <span>Look {index + 1}</span>
                        </div>
                      )}
                      <div className="tryon-image-label">Look {index + 1}</div>
                      {selectedImage === generatedImages[index] && generatedImages[index] && !loadingImages[index] && (
                        <div className="tryon-image-check">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M20 6L9 17l-5-5"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="tryon-modal-footer">
              <button
                className="btn btn-outline"
                onClick={handleGenerateAll}
                disabled={isGeneratingAll || loadingImages.some(l => l)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
                </svg>
                Regenerate All
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmSelection}
                disabled={!selectedImage}
              >
                {selectedImage ? 'Use This Look' : 'Select a Look'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Game;
