import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { productApi } from '../services/api';
import useGameStore from '../store/gameStore';

function Home() {
  const navigate = useNavigate();
  const { startTour } = useGameStore();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [username, setUsername] = useState('');
  const [images, setImages] = useState([]);
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
          <button onClick={() => navigate('/browse')} className="btn btn-secondary">
            Browse Rooms
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </button>
        </div>

        <div className="home-secondary-actions">
          <button onClick={() => navigate('/hall-of-fame?tab=winners')} className="home-secondary-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            Past Winners
          </button>
          <span className="home-secondary-divider">·</span>
          <button onClick={() => navigate('/hall-of-fame?tab=popular')} className="home-secondary-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
            Popular Clothes
          </button>
          <span className="home-secondary-divider">·</span>
          <button onClick={startTour} className="home-secondary-btn">
            How It Works
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

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
