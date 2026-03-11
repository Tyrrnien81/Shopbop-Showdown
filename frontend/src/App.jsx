import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home, CreateGame, Lobby, Game, Voting, Results } from './pages';
import GuidedTour from './components/GuidedTour';
import useGameStore from './store/gameStore';
import './App.css';

function AppContent() {
  const { tourActive, endTour } = useGameStore();

  return (
    <>
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CreateGame />} />
          <Route path="/lobby/:gameId" element={<Lobby />} />
          <Route path="/game/:gameId" element={<Game />} />
          <Route path="/voting/:gameId" element={<Voting />} />
          <Route path="/results/:gameId" element={<Results />} />
        </Routes>
      </div>
      <GuidedTour active={tourActive} onClose={endTour} />
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
