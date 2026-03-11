import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { productApi } from '../services/api';

const ONBOARDING_STEPS = [
  {
    step: '01',
    title: 'Pick a Theme',
    description: 'Choose from curated style challenges like Runway Ready, Streetwear Icon, or Beach Vacation.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    step: '02',
    title: 'Build Your Outfit',
    description: 'Browse real Shopbop products, mix and match up to 5 items, and stay within your budget.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
  },
  {
    step: '03',
    title: 'Try It On with AI',
    description: 'See your outfit on a virtual model. Upload your photo or generate an AI avatar that looks like you.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
  {
    step: '04',
    title: 'AI Style Assistant',
    description: 'Chat with our AI stylist for personalized recommendations. It searches Shopbop in real time.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    step: '05',
    title: 'Vote & Win',
    description: 'Rate your friends\' looks, see the final rankings, and share the results.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 21h8M12 17v4M17 4H7l-2 8h14l-2-8zM12 4V2"/>
      </svg>
    ),
  },
];

function Home() {
  const navigate = useNavigate();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [username, setUsername] = useState('');
  const [images, setImages] = useState([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const track1Ref = useRef(null);
  const track2Ref = useRef(null);
  const track3Ref = useRef(null);
  const track4Ref = useRef(null);

  // Fetch product images for the background carousel
  useEffect(() => {
    const fetchImages = async () => {
      try {
        const categories = ['Dresses', 'Shoes', 'Tops', 'Jewelry', 'Outerwear'];
        const results = await Promise.all(
          categories.map(cat =>
            productApi.searchProducts({ category: cat, limit: 12 })
              .then(r => r.data.products || [])
              .catch(() => [])
          )
        );
        const allImages = results.flat()
          .filter(p => p.imageUrl)
          .map(p => ({ src: p.imageUrl, name: p.name }));
        setImages(allImages);
      } catch {
        // Silently fail — carousel is decorative
      }
    };
    fetchImages();
  }, []);

  // Split images into four rows for the marquee
  const chunkSize = Math.ceil(images.length / 4);
  const row1 = images.slice(0, chunkSize);
  const row2 = images.slice(chunkSize, chunkSize * 2);
  const row3 = images.slice(chunkSize * 2, chunkSize * 3);
  const row4 = images.slice(chunkSize * 3);

  // Pause animation on hover
  const handleMouseEnter = (ref) => {
    if (ref.current) ref.current.style.animationPlayState = 'paused';
  };
  const handleMouseLeave = (ref) => {
    if (ref.current) ref.current.style.animationPlayState = 'running';
  };

  const handleCreateGame = () => {
    navigate('/create');
  };

  const handleJoinGame = (e) => {
    e.preventDefault();
    if (joinCode && username) {
      navigate(`/lobby/${joinCode}?username=${encodeURIComponent(username)}`);
    }
  };

  const handleOnboardingClose = () => {
    setShowOnboarding(false);
    setOnboardingStep(0);
  };

  const currentStep = ONBOARDING_STEPS[onboardingStep];
  const isLastStep = onboardingStep === ONBOARDING_STEPS.length - 1;

  return (
    <div className="home-container">
      {/* Background carousel */}
      {images.length > 0 && (
        <div className="home-carousel-bg">
          <div
            className="carousel-track carousel-track-left"
            ref={track1Ref}
            onMouseEnter={() => handleMouseEnter(track1Ref)}
            onMouseLeave={() => handleMouseLeave(track1Ref)}
          >
            {[...row1, ...row1].map((img, i) => (
              <div key={i} className="carousel-card">
                <img src={img.src} alt={img.name} />
              </div>
            ))}
          </div>
          <div
            className="carousel-track carousel-track-right"
            ref={track2Ref}
            onMouseEnter={() => handleMouseEnter(track2Ref)}
            onMouseLeave={() => handleMouseLeave(track2Ref)}
          >
            {[...row2, ...row2].map((img, i) => (
              <div key={i} className="carousel-card">
                <img src={img.src} alt={img.name} />
              </div>
            ))}
          </div>
          <div
            className="carousel-track carousel-track-left"
            ref={track3Ref}
            onMouseEnter={() => handleMouseEnter(track3Ref)}
            onMouseLeave={() => handleMouseLeave(track3Ref)}
          >
            {[...row3, ...row3].map((img, i) => (
              <div key={i} className="carousel-card">
                <img src={img.src} alt={img.name} />
              </div>
            ))}
          </div>
          <div
            className="carousel-track carousel-track-right"
            ref={track4Ref}
            onMouseEnter={() => handleMouseEnter(track4Ref)}
            onMouseLeave={() => handleMouseLeave(track4Ref)}
          >
            {[...row4, ...row4].map((img, i) => (
              <div key={i} className="carousel-card">
                <img src={img.src} alt={img.name} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main content overlay */}
      <div className="home-content">
        <div className="home-presented-by">
          <span>Presented by Amazon Shopbop</span>
        </div>

        <div className="home-title">
          <h1>
            <span className="style-text">Style</span>
            <span className="showdown-text">Showdown</span>
          </h1>
        </div>

        <p className="home-tagline">
          Stop guessing. Get instant feedback from friends in a high-stakes style showdown.
          Curated trends, real-time budgets.
        </p>

        <div className="home-actions">
          <button onClick={handleCreateGame} className="btn btn-primary">
            Start a Room
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button onClick={() => setShowJoinModal(true)} className="btn btn-secondary">
            Join Friends
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </button>
        </div>

        <button
          onClick={() => setShowOnboarding(true)}
          className="how-it-works-link"
        >
          How It Works
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Onboarding Modal */}
      {showOnboarding && (
        <div className="onboarding-overlay" onClick={handleOnboardingClose}>
          <div className="onboarding-card" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button className="onboarding-close" onClick={handleOnboardingClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>

            {/* Step indicator */}
            <div className="onboarding-step-indicator">
              {ONBOARDING_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`onboarding-dot ${i === onboardingStep ? 'active' : ''} ${i < onboardingStep ? 'done' : ''}`}
                  onClick={() => setOnboardingStep(i)}
                />
              ))}
            </div>

            {/* Content */}
            <div className="onboarding-icon">{currentStep.icon}</div>
            <div className="onboarding-step-label">Step {currentStep.step}</div>
            <h2 className="onboarding-title">{currentStep.title}</h2>
            <p className="onboarding-description">{currentStep.description}</p>

            {/* Navigation */}
            <div className="onboarding-nav">
              {onboardingStep > 0 ? (
                <button
                  className="btn btn-outline onboarding-btn"
                  onClick={() => setOnboardingStep(s => s - 1)}
                >
                  Back
                </button>
              ) : (
                <div />
              )}
              {isLastStep ? (
                <button className="btn btn-primary onboarding-btn" onClick={handleOnboardingClose}>
                  Get Started
                </button>
              ) : (
                <button
                  className="btn btn-primary onboarding-btn"
                  onClick={() => setOnboardingStep(s => s + 1)}
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Join Modal */}
      {showJoinModal && (
        <div className="join-modal" onClick={() => setShowJoinModal(false)}>
          <div className="join-modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Join a Room</h2>
            <form onSubmit={handleJoinGame}>
              <div className="form-group">
                <label className="form-label">Your Name</label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Room Code</label>
                <input
                  type="text"
                  placeholder="Enter room code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowJoinModal(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Join Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
