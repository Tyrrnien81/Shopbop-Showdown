import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { generateTryOnImage, generateSingleTryOnImage } from '../services/geminiApi';
import { productApi, outfitApi, chatApi, avatarApi, gameApi } from '../services/api';
import useGameStore from '../store/gameStore';
import socketService from '../services/socket';

// Sort options supported by the Shopbop API
const SORT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'price_low_to_high', label: 'Price: Low → High' },
  { value: 'price_high_to_low', label: 'Price: High → Low' },
  { value: 'editors_pick', label: "Editor's Pick" },
  { value: 'most_loved', label: 'Most Loved' },
  { value: 'top_rated', label: 'Top Rated' },
];

// Color options with hex values for swatches
const COLOR_OPTIONS = [
  { value: 'All', label: 'All', hex: null },
  { value: 'Black', label: 'Black', hex: '#000000' },
  { value: 'White', label: 'White', hex: '#FFFFFF' },
  { value: 'Red', label: 'Red', hex: '#CC0000' },
  { value: 'Blue', label: 'Blue', hex: '#2255CC' },
  { value: 'Green', label: 'Green', hex: '#228833' },
  { value: 'Pink', label: 'Pink', hex: '#E891B2' },
  { value: 'Beige', label: 'Beige', hex: '#D4B896' },
  { value: 'Brown', label: 'Brown', hex: '#7B4B2A' },
  { value: 'Navy', label: 'Navy', hex: '#1B2A4A' },
  { value: 'Gray', label: 'Gray', hex: '#999999' },
];

// Outfit validation rules - only one dress allowed
const MAX_ONE_CATEGORIES = ['Dresses'];

function Game() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const {
    game,
    currentPlayer,
    currentOutfit,
    userPhoto,
    setUserPhoto,
    addProductToOutfit,
    removeProductFromOutfit,
    setLoading,
    isSinglePlayer,
  } = useGameStore();

  const [timeRemaining, setTimeRemaining] = useState(game?.timeLimit || 300);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [validationErrors, setValidationErrors] = useState([]);

  // Filter state
  const [gender, setGender] = useState('womens');
  const dept = gender === 'mens' ? 'MENS' : 'WOMENS';
  const [sortBy, setSortBy] = useState('');
  const [selectedColor, setSelectedColor] = useState('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [appliedMinPrice, setAppliedMinPrice] = useState('');
  const [appliedMaxPrice, setAppliedMaxPrice] = useState('');

  // Virtual try-on modal state
  const [showModal, setShowModal] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([null, null, null]);
  const [loadingImages, setLoadingImages] = useState([false, false, false]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generationError, setGenerationError] = useState(null);

  // Avatar generation state (for photo section in try-on modal)
  const [photoTab, setPhotoTab] = useState('upload');
  const [avatarForm, setAvatarForm] = useState({
    gender: '', ethnicity: '', height: '', waistSize: '', topSize: '',
  });
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState(null);

  // Popup notification state
  const [popupMessage, setPopupMessage] = useState(null);
  const [popupTitle, setPopupTitle] = useState(null);

  const closePopup = () => { setPopupMessage(null); setPopupTitle(null); };
  const showPopup = (title, body) => { setPopupTitle(title); setPopupMessage(body); };

  // Chat-featured products shown in main grid
  const [chatFeatured, setChatFeatured] = useState([]);

  // Wallet spend animation
  const [walletSpend, setWalletSpend] = useState(false);

  // Waiting room state
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Mobile bottom tray state
  const [mobileTrayOpen, setMobileTrayOpen] = useState(false);

  // Chat assistant state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'bot', text: "Hi! I'm your style assistant. Ask me for outfit ideas, or tell me what you're looking for!" },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatMessagesRef = useRef(null);
  const photoInputRef = useRef(null);

  // Live player submission tracker (multiplayer only)
  const [submissionStatus, setSubmissionStatus] = useState({ submitted: 0, total: 0, players: [] });

  const [gameLoaded, setGameLoaded] = useState(!!game);

  // Recover game & player data on reload / tab switch
  useEffect(() => {
    const recover = async () => {
      try {
        const res = await gameApi.getGame(gameId);
        const g = res.data.game || res.data;
        if (g) {
          useGameStore.getState().setGame(g);
          if (g.status === 'VOTING') { navigate(`/voting/${gameId}`); return; }
          if (g.status === 'COMPLETED') { navigate(`/results/${gameId}`); return; }
        }
      } catch { /* ignore */ }
      setGameLoaded(true);
    };
    recover();
  }, [gameId, navigate]);

  // Sync selectedProducts set with persisted outfit on mount
  useEffect(() => {
    const persisted = currentOutfit.products.map(p => p.productSin);
    if (persisted.length > 0) {
      setSelectedProducts(new Set(persisted));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const budget = game?.budget || 5000;
  const theme = game?.theme || 'Runway Ready';

  // Ensure socket is connected and listen for outfit submissions
  useEffect(() => {
    const { currentPlayer } = useGameStore.getState();
    if (currentPlayer?.playerId) {
      socketService.connect(gameId, currentPlayer.playerId);
    }

    const onOutfitSubmitted = ({ gameStatus, submittedCount, totalPlayers }) => {
      if (submittedCount != null && totalPlayers != null) {
        setSubmissionStatus(prev => ({ ...prev, submitted: submittedCount, total: totalPlayers }));
      }
      if (gameStatus === 'VOTING') {
        navigate(`/voting/${gameId}`);
      } else if (gameStatus === 'COMPLETED') {
        navigate(`/results/${gameId}`);
      }
    };

    socketService.on('outfit-submitted', onOutfitSubmitted);
    return () => socketService.off('outfit-submitted', onOutfitSubmitted);
  }, [gameId, navigate]);

  const handleApplyPrice = () => {
    setAppliedMinPrice(minPrice);
    setAppliedMaxPrice(maxPrice);
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  const handleSendMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    setChatInput('');
    const updatedMessages = [...chatMessages, { role: 'user', text }];
    setChatMessages(updatedMessages);
    setChatLoading(true);

    try {
      // Send prior conversation history (exclude product data to keep payload small)
      const history = updatedMessages.map(m => ({ role: m.role, text: m.text }));
      const res = await chatApi.sendMessage({
        message: text,
        outfitContext: currentOutfit.products,
        theme,
        budget,
        history,
      });
      const { reply, products } = res.data;
      setChatMessages(prev => [...prev, { role: 'bot', text: reply, products: products?.length ? products : undefined }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'bot', text: "Sorry, I couldn't process that. Try again!" }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatAddProduct = (product) => {
    handleProductClick(product);
    setChatMessages(prev => [...prev, { role: 'bot', text: `Added "${product.name}" to your board!` }]);
  };

  const handleShowInMain = (chatProducts) => {
    setChatFeatured(chatProducts);
    // Scroll products panel to top so the featured section is visible
    const panel = document.querySelector('.products-panel');
    if (panel) panel.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Load products from ShopBop catalog (re-fetches when filters change)
  useEffect(() => {
    let stale = false;
    const CATEGORIES_TO_FETCH = gender === 'mens'
      ? ['Tops', 'Bottoms', 'Shoes', 'Outerwear', 'Suits', 'Accessories']
      : ['Dresses', 'Tops', 'Bottoms', 'Shoes', 'Jewelry', 'Outerwear', 'Accessories'];

    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        const filterParams = { limit: 10, theme, dept };
        if (sortBy) filterParams.sort = sortBy;
        if (selectedColor && selectedColor !== 'All') filterParams.color = selectedColor;
        if (appliedMinPrice) filterParams.minPrice = appliedMinPrice;
        if (appliedMaxPrice) filterParams.maxPrice = appliedMaxPrice;

        // Fetch items per category in parallel
        const results = await Promise.all(
          CATEGORIES_TO_FETCH.map(cat =>
            productApi.searchProducts({ ...filterParams, category: cat })
              .then(r => r.data.products || [])
              .catch(() => [])
          )
        );
        if (stale) return; // discard results if a newer fetch has started

        // Deduplicate by productSin across categories
        const seen = new Set();
        const all = results.flat()
          .filter(p => p.productSin && p.name && p.imageUrl)
          .filter(p => {
            if (seen.has(p.productSin)) return false;
            seen.add(p.productSin);
            return true;
          });
        setProducts(all);
      } catch (err) {
        if (stale) return;
        console.error('Failed to load products:', err);
        showPopup('Connection Error', 'Could not load products from ShopBop. Check that the backend is running.');
      } finally {
        if (!stale) setLoadingProducts(false);
      }
    };

    fetchProducts();
    return () => { stale = true; };
  }, [theme, sortBy, appliedMinPrice, appliedMaxPrice, selectedColor, gender, dept]);

  // Get categories in current outfit
  const getOutfitCategories = useCallback(() => {
    const categories = new Set();
    currentOutfit.products.forEach(p => categories.add(p.category));
    return categories;
  }, [currentOutfit.products]);

  // Check if adding a product would violate outfit rules (max one dress)
  const wouldViolateMutualExclusion = useCallback((product) => {
    if (MAX_ONE_CATEGORIES.includes(product.category)) {
      const alreadyHasOne = currentOutfit.products.some(p => p.category === product.category);
      if (alreadyHasOne) {
        return `You can only choose one dress at a time. Remove your current dress first!`;
      }
    }
    return null;
  }, [currentOutfit.products]);

  // Validate outfit completeness
  const validateOutfit = useCallback(() => {
    const errors = [];
    const categories = getOutfitCategories();

    // Check for shoes
    if (!categories.has('Shoes')) {
      errors.push('Missing: Shoes');
    }

    if (gender === 'mens') {
      // Men's validation: need tops + bottoms
      if (!categories.has('Tops')) errors.push('Missing: Top');
      if (!categories.has('Bottoms')) errors.push('Missing: Bottoms');
    } else {
      // Women's validation
      if (!categories.has('Jewelry')) {
        errors.push('Missing: Jewelry');
      }

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
    }

    return errors;
  }, [getOutfitCategories, gender]);

  // Update validation errors when outfit changes
  useEffect(() => {
    setValidationErrors(validateOutfit());
  }, [currentOutfit.products, validateOutfit]);

  // Photo upload for single player mode (skips lobby)
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onloadend = () => setUserPhoto(reader.result);
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setUserPhoto(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleGenerateAvatar = async () => {
    setGeneratingAvatar(true);
    setAvatarError(null);
    try {
      const res = await avatarApi.generate(avatarForm);
      const { base64, mimeType } = res.data;
      setUserPhoto(`data:${mimeType};base64,${base64}`);
      setPhotoTab('upload');
    } catch (err) {
      setAvatarError(err.response?.data?.error || 'Failed to generate avatar');
    } finally {
      setGeneratingAvatar(false);
    }
  };

  // Open modal — auto-generate if user has a photo set
  const handleOpenModal = () => {
    if (currentOutfit.products.length === 0) {
      setGenerationError('Please select items first');
      return;
    }
    setShowModal(true);
    setGenerationError(null);
    if (userPhoto && !generatedImages.some(img => img)) {
      // Kick off generation immediately using their photo as the model
      setTimeout(() => handleGenerateAll(), 0);
    }
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
    if (currentOutfit.products.length < 3) {
      showPopup('Not Enough Items', 'Please add at least 3 items to your outfit before submitting.');
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
          tryOnImage: selectedImage || null,
        });
      }
      const { isSinglePlayer } = useGameStore.getState();
      if (isSinglePlayer) {
        navigate(`/results/${gameId}`);
      } else {
        setHasSubmitted(true);
      }
    } catch {
      showPopup('Submission Error', 'Failed to submit outfit. Please try again.');
      // In solo mode, navigate to results even on error so user isn't stuck
      const { isSinglePlayer: solo } = useGameStore.getState();
      if (solo) {
        setTimeout(() => navigate(`/results/${gameId}`), 1500);
      }
    } finally {
      setLoading(false);
    }
  }, [currentOutfit, gameId, navigate, setLoading, selectedImage]);

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

  // Poll player submission status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await gameApi.getPlayers(gameId);
        // const playerList = response.data.players || [];
        // const submitted = playerList.filter(p => p.hasSubmitted).length;
        // setSubmissionStatus({
        //   submitted,
        //   total: playerList.length,
        //   players: playerList.map(p => ({ name: p.username, submitted: p.hasSubmitted })),
        // });
        const contestants = playerList.filter(p => !p.isAudience);
        const submitted = contestants.filter(p => p.hasSubmitted).length;
        setSubmissionStatus({
          submitted,
          total: contestants.length,
          players: contestants.map(p => ({ name: p.username, submitted: p.hasSubmitted })),
        });
      } catch { /* ignore */ }
    };

    fetchStatus();
    const poll = setInterval(fetchStatus, 3000);
    return () => clearInterval(poll);
  }, [gameId, isSinglePlayer]);

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
        showPopup('Item Conflict', violation);
        return;
      }

      // Check 5-item limit
      if (currentOutfit.products.length >= 5) {
        showPopup('Outfit Full', 'You can add at most 5 items. Remove one to swap it for something new.');
        return;
      }

      // Check budget
      const projected = currentOutfit.totalPrice + product.price;
      if (game && projected > game.budget) {
        const over = Math.ceil(projected - game.budget);
        showPopup(
          'Over Budget!',
          `"${product.name}" costs $${product.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} but you only have $${budgetRemaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} left — that's $${over.toLocaleString()} over your $${budget.toLocaleString()} limit. Remove a pricier item or choose something more affordable.`
        );
        return;
      }

      // Add to outfit
      const success = addProductToOutfit(product);
      if (success) {
        setSelectedProducts((prev) => new Set([...prev, product.productSin]));
        // Clear selected image when outfit changes
        setSelectedImage(null);
        // Trigger wallet spend animation
        setWalletSpend(true);
        setTimeout(() => setWalletSpend(false), 600);
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

  const budgetBarColor =
    budgetPercentage >= 95 ? '#ef4444' :
    budgetPercentage >= 80 ? '#f97316' :
    budgetPercentage >= 60 ? '#f59e0b' :
    '#22c55e';

  const walletClass = `game-wallet${walletSpend ? ' spending' : ''}${budgetPercentage >= 95 ? ' budget-critical' : budgetPercentage >= 80 ? ' budget-warning' : ''}`;

  // Poll game status to detect phase changes (fallback if socket misses it)
  useEffect(() => {
    if (!hasSubmitted || isSinglePlayer) return;
    const pollGameStatus = async () => {
      try {
        const response = await gameApi.getGame(gameId);
        const g = response.data.game || response.data;
        const status = g?.status;
        if (status === 'VOTING') navigate(`/voting/${gameId}`);
        else if (status === 'COMPLETED') navigate(`/results/${gameId}`);
      } catch { /* ignore */ }
    };
    pollGameStatus();
    const poll = setInterval(pollGameStatus, 2000);
    return () => clearInterval(poll);
  }, [hasSubmitted, isSinglePlayer, gameId, navigate]);

  // Loading state while game data is being fetched
  if (!gameLoaded && !game) {
    return (
      <div className="waiting-room">
        <div className="waiting-room-card">
          <div className="waiting-room-brand">
            <img src="/shopbop-favicon.svg" alt="Shopbop" style={{ width: 32, height: 32 }} />
            <span>Style Showdown</span>
          </div>
          <div className="waiting-room-status">
            <h2>Loading Game...</h2>
            <p>Fetching game data, hang tight!</p>
          </div>
        </div>
      </div>
    );
  }

  // Audience spectator screen — audience members wait here until voting
  if (currentPlayer?.isAudience) {
    const pct = submissionStatus.total > 0 ? (submissionStatus.submitted / submissionStatus.total) * 100 : 0;
    return (
      <div className="waiting-room">
        <div className="waiting-room-card">
          <div className="waiting-room-brand">
            <img src="/shopbop-favicon.svg" alt="Shopbop" style={{ width: 32, height: 32 }} />
            <span>Style Showdown</span>
          </div>
          <div className="audience-badge">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Audience Mode
          </div>
          <div className="waiting-room-status">
            <h2>Players are styling...</h2>
            <p>Sit back and relax! You'll vote on the outfits once everyone submits.</p>
          </div>
          {submissionStatus.total > 0 && (
            <div className="waiting-room-progress">
              <div className="waiting-room-progress-header">
                <span>Outfits Submitted</span>
                <span className="waiting-room-progress-count">{submissionStatus.submitted}/{submissionStatus.total}</span>
              </div>
              <div className="waiting-room-progress-bar">
                <div className="waiting-room-progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
          {timeRemaining > 0 && (
            <div className="waiting-room-timer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')} remaining
            </div>
          )}
        </div>
      </div>
    );
  }

  // Waiting room: show after multiplayer submission while waiting for others
  if (hasSubmitted && !isSinglePlayer) {
    const pct = submissionStatus.total > 0 ? (submissionStatus.submitted / submissionStatus.total) * 100 : 0;
    return (
      <div className="waiting-room">
        <div className="waiting-room-card">
          {/* Brand header */}
          <div className="waiting-room-brand">
            <img src="/shopbop-favicon.svg" alt="Shopbop" style={{ width: 32, height: 32 }} />
            <span>Style Showdown</span>
          </div>

          {/* Timer */}
          {timeRemaining > 0 && (
            <div className={`waiting-room-timer${timeRemaining <= 30 ? ' urgent' : ''}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>{formatTime(timeRemaining)}</span>
            </div>
          )}

          {/* Status message */}
          <div className="waiting-room-status">
            <h2>Outfit Submitted!</h2>
            <p>Waiting for other players to finish shopping...</p>
          </div>

          {/* Progress section */}
          {submissionStatus.total > 0 && (
            <div className="waiting-room-progress">
              <div className="waiting-room-progress-header">
                <span className="waiting-room-progress-label">Players Ready</span>
                <span className="waiting-room-progress-count">{submissionStatus.submitted}/{submissionStatus.total}</span>
              </div>
              <div className="waiting-room-progress-bar">
                <div className="waiting-room-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              {/* Player dots */}
              <div className="waiting-room-players">
                {submissionStatus.players?.map((p, i) => (
                  <div key={i} className={`waiting-room-player${p.submitted ? ' done' : ''}`}>
                    <div className="waiting-room-player-dot" />
                    <span>{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action button */}
          <button className="btn btn-outline" onClick={() => setHasSubmitted(false)}>
            Edit My Outfit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-container">
      {/* Header */}
      <header className="game-header">
        <div className="game-brand">
          <img src="/shopbop-favicon.svg" alt="Shopbop" className="game-brand-logo" />
          <div>
            <span className="game-brand-title">Style Showdown</span>
            <span className="game-brand-subtitle">Presented by Shopbop</span>
          </div>
        </div>

        <div className="game-theme-display">
          <span className="game-theme-label">Active Theme</span>
          <span className="game-theme-value">{theme}</span>
        </div>

        <div className={`game-timer-header${timeRemaining <= 30 ? ' warning' : ''}`}>
          <span className="game-timer-label">Time Left</span>
          <span className="game-timer-value">
            <svg className="timer-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* Bell tops */}
              <path d="M4 4 L7.5 7" />
              <path d="M20 4 L16.5 7" />
              {/* Clock body */}
              <circle cx="12" cy="13" r="8" />
              {/* Clock hands */}
              <polyline points="12 9 12 13 15.5 14.5" />
              {/* Top knob */}
              <line x1="10" y1="5" x2="14" y2="5" />
              <line x1="12" y1="3" x2="12" y2="5" />
            </svg>
            {formatTime(timeRemaining)}
          </span>
        </div>

        <div className={walletClass}>
          <span className="game-wallet-label">Wallet</span>
          <span className="game-wallet-value">
            <svg className="wallet-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 7c0-1.1.9-2 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7z" />
              <path d="M2 7h20" />
              <path d="M16 14a1 1 0 1 0 2 0 1 1 0 0 0-2 0" />
              <path d="M2 11h4" />
            </svg>
            ${budgetRemaining.toLocaleString()}
          </span>
          {walletSpend && <span className="wallet-spend-fly">-$</span>}
        </div>

        {/* Live Submission Tracker */}
        {submissionStatus.total > 0 && (
          <div className="submission-chip">
            <span className="submission-chip-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Players
            </span>
            <span className="submission-chip-count">{submissionStatus.submitted}/{submissionStatus.total}</span>
            <div className="submission-chip-bar">
              <div
                className="submission-chip-bar-fill"
                style={{ width: `${(submissionStatus.submitted / submissionStatus.total) * 100}%` }}
              />
            </div>
            <div className="submission-chip-dots">
              {(submissionStatus.players || []).map((p, i) => (
                <span
                  key={i}
                  className={`submission-chip-dot ${p.submitted ? 'done' : ''}`}
                  title={`${p.name}${p.submitted ? ' - Submitted' : ' - Working...'}`}
                />
              ))}
            </div>
          </div>
        )}
      </header>

      <div className="game-content">
        {/* Products Panel */}
        <main className="products-panel">
          <div className="products-header">
            <h2>Curated Pieces for {theme}</h2>
            <p>Click items to add them to your board.</p>
          </div>

          {/* Gender + Category filter tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-light)', alignItems: 'center' }}>
            <div className="gender-toggle-inline">
              <button
                className={`gender-btn${gender === 'womens' ? ' active' : ''}`}
                onClick={() => { setGender('womens'); setSelectedCategory('All'); }}
              >
                Women's
              </button>
              <button
                className={`gender-btn${gender === 'mens' ? ' active' : ''}`}
                onClick={() => { setGender('mens'); setSelectedCategory('All'); }}
              >
                Men's
              </button>
            </div>
            <div style={{ width: '1px', height: '20px', background: 'var(--border-medium)', margin: '0 4px' }} />
            {['All', ...(gender === 'mens'
              ? ['Tops', 'Bottoms', 'Shoes', 'Outerwear', 'Suits', 'Accessories']
              : ['Dresses', 'Tops', 'Bottoms', 'Shoes', 'Jewelry', 'Outerwear', 'Accessories']
            )].map(cat => (
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

          {/* Filter bar: Sort, Color, Price */}
          <div className="filter-bar">
            <div className="filter-group">
              <label>Sort</label>
              <select
                className="filter-select"
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Color</label>
              <div className="color-swatches">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c.value}
                    className={`color-swatch${selectedColor === c.value ? ' active' : ''}`}
                    style={{
                      background: c.hex || 'linear-gradient(135deg, #f00, #0f0, #00f)',
                      ...(c.value === 'White' ? { border: '2px solid #ccc' } : {}),
                    }}
                    title={c.label}
                    onClick={() => setSelectedColor(c.value)}
                  />
                ))}
              </div>
            </div>

            <div className="filter-group">
              <label>Price Range</label>
              <div className="price-range">
                <input
                  type="number"
                  className="price-input"
                  placeholder="Min"
                  value={minPrice}
                  onChange={e => setMinPrice(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleApplyPrice()}
                />
                <span className="separator">–</span>
                <input
                  type="number"
                  className="price-input"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={e => setMaxPrice(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleApplyPrice()}
                />
                <button className="btn-apply-price" onClick={handleApplyPrice}>Go</button>
              </div>
            </div>
          </div>

          {/* Chat-featured products */}
          {chatFeatured.length > 0 && (
            <div className="chat-featured-section">
              <div className="chat-featured-header">
                <div className="chat-featured-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  From Style Assistant
                </div>
                <button className="chat-featured-dismiss" onClick={() => setChatFeatured([])}>
                  Dismiss
                </button>
              </div>
              <div className="products-grid">
                {chatFeatured.map((product) => {
                  const isOverBudget = !selectedProducts.has(product.productSin) && game?.budget != null && product.price > budgetRemaining;
                  return (
                  <div
                    key={product.productSin}
                    className={`product-card ${selectedProducts.has(product.productSin) ? 'selected' : ''} ${isOverBudget ? 'over-budget' : ''}`}
                    onClick={() => handleProductClick(product)}
                  >
                    <div className="product-image-container">
                      <img src={product.imageUrl} alt={product.name} referrerPolicy="no-referrer" loading="lazy" decoding="async" onLoad={e => e.target.classList.add('loaded')} />
                      {selectedProducts.has(product.productSin) && (
                        <div className="product-check">✓</div>
                      )}
                      <div className="product-heart">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill={selectedProducts.has(product.productSin) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                      </div>
                    </div>
                    <div className="product-info">
                      <span className="product-brand">{product.brand || product.category}</span>
                      <span className="product-name">{product.name}</span>
                      <span className="product-price">${product.price.toFixed(2)}</span>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

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
              .map((product) => {
                const isOverBudget = !selectedProducts.has(product.productSin) && game?.budget != null && product.price > budgetRemaining;
                return (
              <div
                key={product.productSin}
                className={`product-card ${selectedProducts.has(product.productSin) ? 'selected' : ''} ${isOverBudget ? 'over-budget' : ''}`}
                onClick={() => handleProductClick(product)}
              >
                <div className="product-image-container">
                  <img src={product.imageUrl} alt={product.name} referrerPolicy="no-referrer" loading="lazy" decoding="async" onLoad={e => e.target.classList.add('loaded')} />
                  {selectedProducts.has(product.productSin) && (
                    <div className="product-check">✓</div>
                  )}
                  <div className="product-heart">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={selectedProducts.has(product.productSin) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                  </div>
                </div>
                <div className="product-info">
                  <span className="product-brand">{product.brand || product.category}</span>
                  <span className="product-name">{product.name}</span>
                  <div className="product-price-row">
                    <span className="product-price">${product.price.toFixed(2)}</span>
                    {product.productUrl && (
                      <a href={product.productUrl} target="_blank" rel="noopener noreferrer" className="product-shop-link" onClick={e => e.stopPropagation()} title="View on Shopbop">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              </div>
                );
              })}
          </div>
        </main>

        {/* The Board (Outfit Panel) - Always show Pinterest board */}
        <aside className="outfit-panel">
          <div className="outfit-panel-header">
            <h3>The Board</h3>
            <span className="outfit-panel-subtitle">Your Curated Look</span>
          </div>

          {/* Pinterest-style outfit board */}
          <div className="outfit-items">
            <div className="outfit-items-grid">
              {currentOutfit.products.map((product) => (
                <div key={product.productSin} className="outfit-item">
                  <img src={product.imageUrl} alt={product.name} referrerPolicy="no-referrer" loading="lazy" decoding="async" onLoad={e => e.target.classList.add('loaded')} />
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
              {[...Array(Math.max(0, 5 - currentOutfit.products.length))].map((_, i) => (
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
                style={{ width: `${Math.min(budgetPercentage, 100)}%`, background: budgetBarColor }}
              />
            </div>
            {budgetPercentage >= 80 && (
              <p className={`budget-status${budgetPercentage >= 95 ? ' critical' : ' warning'}`}>
                {budgetPercentage >= 100
                  ? 'Budget maxed out!'
                  : budgetPercentage >= 95
                  ? `Only $${Math.round(budgetRemaining).toLocaleString()} left!`
                  : `$${Math.round(budgetRemaining).toLocaleString()} remaining`}
              </p>
            )}
            {!isOutfitComplete && validationErrors.length > 0 && (
              <div className="outfit-needs">
                <span className="outfit-needs-label">Need:</span>
                {validationErrors.map((err, i) => (
                  <span key={i} className="outfit-needs-tag">{err.replace('Missing: ', '')}</span>
                ))}
              </div>
            )}
            <button
              onClick={handleSubmitOutfit}
              className={`btn btn-primary${isOutfitComplete ? ' ready' : ''}`}
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

      {/* Chat Bubble */}
      {!chatOpen && (
        <button className="chat-bubble" onClick={() => setChatOpen(true)} title="Style Assistant">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      )}

      {/* Chat Panel */}
      {chatOpen && (
        <div className="chat-panel">
          <div className="chat-header">
            <span className="chat-header-title">Style Assistant</span>
            <button className="chat-header-close" onClick={() => setChatOpen(false)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div className="chat-messages" ref={chatMessagesRef}>
            {chatMessages.map((msg, i) => (
              <div key={i}>
                <div className={`chat-msg ${msg.role === 'user' ? 'chat-msg-user' : 'chat-msg-bot'}`}>
                  {msg.text.split(/\*\*(.*?)\*\*/).map((part, j) =>
                    j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                  )}
                </div>
                {msg.products && msg.products.length > 0 && (
                  <div className="chat-products">
                    {msg.products.map((p) => (
                      <div key={p.productSin} className="chat-product-card">
                        <img src={p.imageUrl} alt={p.name} referrerPolicy="no-referrer" loading="lazy" decoding="async" onLoad={e => e.target.classList.add('loaded')} />
                        <div className="chat-product-info">
                          <span className="chat-product-name">{p.name}</span>
                          <span className="chat-product-price">${p.price.toLocaleString()}</span>
                        </div>
                        <button className="chat-product-add" onClick={() => handleChatAddProduct(p)}>Add</button>
                      </div>
                    ))}
                    <button
                      className="chat-view-in-main"
                      onClick={() => handleShowInMain(msg.products)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7"/>
                        <rect x="14" y="3" width="7" height="7"/>
                        <rect x="3" y="14" width="7" height="7"/>
                        <rect x="14" y="14" width="7" height="7"/>
                      </svg>
                      View in Main Screen
                    </button>
                  </div>
                )}
              </div>
            ))}
            {chatLoading && (
              <div className="chat-typing">
                <div className="chat-typing-dot" />
                <div className="chat-typing-dot" />
                <div className="chat-typing-dot" />
              </div>
            )}
          </div>
          <div className="chat-input-area">
            <input
              type="text"
              placeholder="Ask for styling advice..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={chatLoading}
            />
            <button className="chat-send-btn" onClick={handleSendMessage} disabled={chatLoading || !chatInput.trim()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            </button>
          </div>
        </div>
      )}

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
                  {/* Photo / Avatar section */}
                  <div className="tryon-photo-section">
                    <input
                      type="file"
                      accept="image/*"
                      ref={photoInputRef}
                      onChange={handlePhotoUpload}
                      style={{ display: 'none' }}
                    />

                    {userPhoto ? (
                      <div className="tryon-photo-preview">
                        <img src={userPhoto} alt="Your photo" />
                        <button className="tryon-photo-remove" onClick={handleRemovePhoto} title="Remove photo">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Tabs */}
                        <div className="tryon-photo-tabs">
                          <button
                            className={`tryon-tab${photoTab === 'upload' ? ' active' : ''}`}
                            onClick={() => setPhotoTab('upload')}
                          >
                            Upload Photo
                          </button>
                          <button
                            className={`tryon-tab${photoTab === 'ai' ? ' active' : ''}`}
                            onClick={() => setPhotoTab('ai')}
                          >
                            AI Generate
                          </button>
                        </div>

                        {photoTab === 'upload' ? (
                          <button className="tryon-photo-btn" onClick={() => photoInputRef.current?.click()}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                              <circle cx="8.5" cy="8.5" r="1.5"/>
                              <polyline points="21 15 16 10 5 21"/>
                            </svg>
                            <span>Upload Your Photo</span>
                            <span className="tryon-photo-hint">So the model looks like you!</span>
                          </button>
                        ) : (
                          <div className="tryon-avatar-form">
                            <p className="tryon-avatar-desc">Describe yourself and we'll generate a model that looks like you</p>
                            <div className="tryon-avatar-grid">
                              <div className="tryon-avatar-field">
                                <label>Gender</label>
                                <select value={avatarForm.gender} onChange={e => setAvatarForm(f => ({ ...f, gender: e.target.value }))}>
                                  <option value="">Any</option>
                                  <option value="woman">Woman</option>
                                  <option value="man">Man</option>
                                  <option value="non-binary person">Non-binary</option>
                                </select>
                              </div>
                              <div className="tryon-avatar-field">
                                <label>Ethnicity</label>
                                <input type="text" placeholder="e.g. South Asian" value={avatarForm.ethnicity} onChange={e => setAvatarForm(f => ({ ...f, ethnicity: e.target.value }))} />
                              </div>
                              <div className="tryon-avatar-field">
                                <label>Height</label>
                                <input type="text" placeholder="e.g. 5ft 6in" value={avatarForm.height} onChange={e => setAvatarForm(f => ({ ...f, height: e.target.value }))} />
                              </div>
                              <div className="tryon-avatar-field">
                                <label>Top Size</label>
                                <select value={avatarForm.topSize} onChange={e => setAvatarForm(f => ({ ...f, topSize: e.target.value }))}>
                                  <option value="">Any</option>
                                  <option value="XS">XS</option>
                                  <option value="S">S</option>
                                  <option value="M">M</option>
                                  <option value="L">L</option>
                                  <option value="XL">XL</option>
                                  <option value="XXL">XXL</option>
                                </select>
                              </div>
                              <div className="tryon-avatar-field full-width">
                                <label>Waist Size</label>
                                <input type="text" placeholder="e.g. 28 or 71cm" value={avatarForm.waistSize} onChange={e => setAvatarForm(f => ({ ...f, waistSize: e.target.value }))} />
                              </div>
                            </div>
                            {avatarError && <p className="tryon-avatar-error">{avatarError}</p>}
                            <button onClick={handleGenerateAvatar} disabled={generatingAvatar} className="btn btn-primary tryon-avatar-btn">
                              {generatingAvatar ? 'Generating...' : 'Generate My Avatar'}
                            </button>
                            <p className="tryon-avatar-note">All fields optional — more detail = better match</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <h3>Ready to Generate</h3>
                  <p>{userPhoto ? 'Your photo is set! Generate 3 AI outfit previews.' : 'Upload a photo or generate an avatar, then create your looks.'}</p>
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
              {generatedImages.some(img => img) && (
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    setGeneratedImages([null, null, null]);
                    setSelectedImage(null);
                    setGenerationError(null);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Change Photo
                </button>
              )}
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

      {/* Mobile Bottom Tray — always visible on small screens */}
      <div className={`mobile-outfit-tray${mobileTrayOpen ? ' expanded' : ''}`}>
        {/* Collapsed tray bar */}
        <button className="mobile-tray-bar" onClick={() => setMobileTrayOpen(!mobileTrayOpen)}>
          <div className="mobile-tray-summary">
            <div className="mobile-tray-thumbs">
              {currentOutfit.products.slice(0, 5).map((p) => (
                <img key={p.productSin} src={p.imageUrl} alt={p.name} referrerPolicy="no-referrer" />
              ))}
              {currentOutfit.products.length === 0 && (
                <span className="mobile-tray-empty-label">No items yet</span>
              )}
            </div>
            <div className="mobile-tray-meta">
              <span className="mobile-tray-count">{currentOutfit.products.length} item{currentOutfit.products.length !== 1 ? 's' : ''}</span>
              <span className="mobile-tray-budget">${currentOutfit.totalPrice.toLocaleString()}</span>
            </div>
          </div>
          <svg className={`mobile-tray-chevron${mobileTrayOpen ? ' open' : ''}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </button>

        {/* Expanded tray content */}
        {mobileTrayOpen && (
          <div className="mobile-tray-content">
            <div className="mobile-tray-items">
              {currentOutfit.products.map((product) => (
                <div key={product.productSin} className="mobile-tray-item">
                  <img src={product.imageUrl} alt={product.name} referrerPolicy="no-referrer" />
                  <span className="mobile-tray-item-cat">{product.category}</span>
                  <button
                    className="mobile-tray-item-remove"
                    onClick={() => handleProductClick(product)}
                  >
                    ×
                  </button>
                </div>
              ))}
              {currentOutfit.products.length === 0 && (
                <div className="mobile-tray-empty">
                  <p>Browse products below and tap to add them to your board</p>
                </div>
              )}
            </div>
            {!isOutfitComplete && validationErrors.length > 0 && (
              <div className="outfit-needs" style={{ padding: '0 16px', marginBottom: 8 }}>
                <span className="outfit-needs-label">Need:</span>
                {validationErrors.map((err, i) => (
                  <span key={i} className="outfit-needs-tag">{err.replace('Missing: ', '')}</span>
                ))}
              </div>
            )}
            <div className="mobile-tray-actions">
              <button
                onClick={handleOpenModal}
                className="btn btn-secondary btn-small"
                disabled={currentOutfit.products.length === 0}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Try On
              </button>
              <button
                onClick={handleSubmitOutfit}
                className={`btn btn-primary btn-small${isOutfitComplete ? ' ready' : ''}`}
                disabled={!isOutfitComplete}
              >
                {isOutfitComplete ? 'Submit Look' : 'Complete Outfit'}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Popup notification */}
      {popupMessage && (
        <div className="popup-overlay" onClick={closePopup}>
          <div className="popup-box" onClick={(e) => e.stopPropagation()}>
            <div className="popup-icon">
              {popupTitle === 'Over Budget!' ? '💸' : popupTitle === 'Outfit Full' ? '👗' : popupTitle === 'Item Conflict' ? '🚫' : '⚠️'}
            </div>
            {popupTitle && <h3 className="popup-title">{popupTitle}</h3>}
            <p>{popupMessage}</p>
            <button className="btn btn-primary" onClick={closePopup}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Game;
