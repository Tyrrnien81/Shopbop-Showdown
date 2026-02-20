import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home, CreateGame, Lobby, Game, Voting, Results } from './pages';
import './App.css';

function App() {
  return (
    <Router>
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
    </Router>
  );
}

export default App;
