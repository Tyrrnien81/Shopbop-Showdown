import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Component, lazy, Suspense } from 'react';
import { Home, CreateGame, Lobby, ThemeVote, Game, Voting, Results, Analytics, HallOfFame, JoinRedirect, BrowseRooms} from './pages';
import GuidedTour from './components/GuidedTour';
import useGameStore from './store/gameStore';
import './App.css';

// Heavy (~600 KB with three.js) — load on demand so it doesn't bloat the homepage bundle.
const RunwayShow = lazy(() => import('./components/RunwayShow/RunwayShow'));

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-cream)' }}>
          <div style={{ textAlign: 'center', padding: '2rem', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: '400px' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>Something went wrong</h2>
            <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: '0.9rem' }}>{this.state.error?.message}</p>
            <button
              className="btn btn-primary"
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
            >
              Back to Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { tourActive, endTour } = useGameStore();

  return (
    <>
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CreateGame />} />
          <Route path="/lobby/:gameId" element={<Lobby />} />
          <Route path="/theme-vote/:gameId" element={<ThemeVote />} />
          <Route path="/game/:gameId" element={<Game />} />
          <Route path="/voting/:gameId" element={<Voting />} />
          <Route path="/results/:gameId" element={<Results />} />
          <Route path="/admin" element={<Analytics />} />
          <Route path="/hall-of-fame" element={<HallOfFame />} />
          <Route path="/join/:gameId" element={<JoinRedirect />} />
          <Route path="/browse" element={<BrowseRooms />} />
          <Route
            path="/runway-test"
            element={
              <Suspense fallback={<div style={{ height: '100vh', background: '#0a0a0a' }} />}>
                <RunwayShow
                  outfits={[
                    {
                      tryOnImageUrl: 'https://picsum.photos/seed/runway-test/600/900',
                      playerName: 'Test Model',
                      totalCost: 1240,
                      itemCount: 5,
                      playerId: 'test-1',
                    },
                  ]}
                  theme="Runway Ready"
                  onComplete={() => console.log('Runway test complete')}
                />
              </Suspense>
            }
          />
        </Routes>
      </div>
      <GuidedTour active={tourActive} onClose={endTour} />
    </>
  );
}

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </Router>
  );
}

export default App;
