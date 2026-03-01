import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { generateTryOnImage, generateSingleTryOnImage } from '../services/geminiApi';
import useGameStore from '../store/gameStore';

// Mock products for development - expanded catalog
const mockProducts = [
  // Tops
  { productSin: 'T001', name: 'Cashmere Sweater', category: 'Tops', brand: 'Nili Lotan', price: 695, imageUrl: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400' },
  { productSin: 'T002', name: 'Silk Blouse', category: 'Tops', brand: 'Equipment', price: 320, imageUrl: 'https://images.unsplash.com/photo-1598554747436-c9293d6a588f?w=400' },
  { productSin: 'T003', name: 'Cropped Tank', category: 'Tops', brand: 'Agolde', price: 78, imageUrl: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=400' },
  { productSin: 'T004', name: 'Linen Button-Down', category: 'Tops', brand: 'Vince', price: 245, imageUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400' },

  // Bottoms
  { productSin: 'B001', name: 'Wide Leg Trousers', category: 'Bottoms', brand: 'Vince', price: 385, imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400' },
  { productSin: 'B002', name: 'High-Waist Jeans', category: 'Bottoms', brand: 'Citizens of Humanity', price: 228, imageUrl: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400' },
  { productSin: 'B003', name: 'Pleated Midi Skirt', category: 'Bottoms', brand: 'Theory', price: 295, imageUrl: 'https://images.unsplash.com/photo-1583496661160-fb5886a0uj1?w=400' },
  { productSin: 'B004', name: 'Leather Pants', category: 'Bottoms', brand: 'Helmut Lang', price: 895, imageUrl: 'https://images.unsplash.com/photo-1551854838-212c50b4c184?w=400' },

  // Dresses
  { productSin: 'D001', name: 'Silk Evening Gown', category: 'Dresses', brand: 'Marchesa', price: 1250, imageUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400' },
  { productSin: 'D002', name: 'Wrap Midi Dress', category: 'Dresses', brand: 'Diane von Furstenberg', price: 498, imageUrl: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400' },
  { productSin: 'D003', name: 'Floral Maxi Dress', category: 'Dresses', brand: 'Zimmermann', price: 695, imageUrl: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400' },
  { productSin: 'D004', name: 'Little Black Dress', category: 'Dresses', brand: 'The Row', price: 890, imageUrl: 'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=400' },

  // Shoes
  { productSin: 'S001', name: 'Luxe Leather Sneakers', category: 'Shoes', brand: 'Golden Goose', price: 450, imageUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400' },
  { productSin: 'S002', name: 'Strappy Heels', category: 'Shoes', brand: 'Aquazzura', price: 750, imageUrl: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400' },
  { productSin: 'S003', name: 'Ankle Boots', category: 'Shoes', brand: 'Isabel Marant', price: 620, imageUrl: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400' },
  { productSin: 'S004', name: 'Ballet Flats', category: 'Shoes', brand: 'Repetto', price: 345, imageUrl: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=400' },

  // Jewelry
  { productSin: 'J001', name: 'Statement Earrings', category: 'Jewelry', brand: 'Jennifer Behr', price: 425, imageUrl: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400' },
  { productSin: 'J002', name: 'Gold Chain Necklace', category: 'Jewelry', brand: 'Monica Vinader', price: 298, imageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400' },
  { productSin: 'J003', name: 'Stackable Rings Set', category: 'Jewelry', brand: 'Mejuri', price: 180, imageUrl: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400' },
  { productSin: 'J004', name: 'Pearl Bracelet', category: 'Jewelry', brand: 'Mikimoto', price: 520, imageUrl: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=400' },

  // Outerwear
  { productSin: 'O001', name: 'Oversized Blazer', category: 'Outerwear', brand: 'The Row', price: 2100, imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400' },
  { productSin: 'O002', name: 'Leather Jacket', category: 'Outerwear', brand: 'AllSaints', price: 498, imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400' },
  { productSin: 'O003', name: 'Trench Coat', category: 'Outerwear', brand: 'Burberry', price: 1990, imageUrl: 'https://images.unsplash.com/photo-1544923246-77307dd628b5?w=400' },

  // Accessories (Bags)
  { productSin: 'A001', name: 'Crocodile Pattern Bag', category: 'Accessories', brand: 'Staud', price: 890, imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400' },
  { productSin: 'A002', name: 'Mini Crossbody', category: 'Accessories', brand: 'Bottega Veneta', price: 1650, imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400' },
  { productSin: 'A003', name: 'Tote Bag', category: 'Accessories', brand: 'Mansur Gavriel', price: 595, imageUrl: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400' },
];

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
  const [products] = useState(mockProducts);
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

    setLoading(true);
    try {
      console.log('Submitting outfit:', currentOutfit);
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
