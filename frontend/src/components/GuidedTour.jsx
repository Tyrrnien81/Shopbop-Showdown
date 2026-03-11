import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { gameApi } from '../services/api';
import useGameStore from '../store/gameStore';

const TOUR_STEPS = [
  {
    route: '/',
    selector: '.home-actions',
    title: 'Welcome to Style Showdown',
    description: 'Start a room to host a fashion showdown, or join a friend\'s game with a code.',
    position: 'bottom',
  },
  {
    route: '/create',
    selector: '.theme-grid',
    title: 'Pick a Theme',
    description: 'Choose from 6 style challenges. Each theme changes the vibe and the products you\'ll see.',
    position: 'bottom',
  },
  {
    route: '/create',
    selector: '.budget-section',
    title: 'Set Your Budget',
    description: 'Slide to set the spending limit. Players must build their outfit within this amount.',
    position: 'top',
  },
  {
    route: '/create',
    selector: '.create-game-footer',
    title: 'Launch the Game',
    description: 'Hit Launch to create your room. Toggle Solo Mode above to skip the lobby for quick testing.',
    position: 'top',
    beforeAction: 'createDemoGame',
  },
  {
    route: '/game/:gameId',
    selector: '.products-panel',
    title: 'Browse Products',
    description: 'Real Shopbop products curated for your theme. Filter by category, color, price, or sort order.',
    position: 'right',
    scrollTo: true,
  },
  {
    route: '/game/:gameId',
    selector: '.outfit-panel',
    title: 'The Board',
    description: 'Click products to add them here. Build an outfit with up to 5 items — shoes, jewelry, and a top/bottom or dress required.',
    position: 'left',
  },
  {
    route: '/game/:gameId',
    selector: '.tryon-section',
    title: 'AI Virtual Try-On',
    description: 'See your outfit on a model. Upload a photo in the lobby so the model looks like you.',
    position: 'left',
  },
  {
    route: '/game/:gameId',
    selector: '.chat-bubble',
    title: 'AI Style Assistant',
    description: 'Chat with our AI stylist for real-time outfit recommendations. It searches Shopbop for you.',
    position: 'left',
  },
];

export default function GuidedTour({ active, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [demoGameId, setDemoGameId] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const observerRef = useRef(null);
  const { setGame, setCurrentPlayer } = useGameStore();

  const currentStep = TOUR_STEPS[step];
  const totalSteps = TOUR_STEPS.length;

  // Resolve route with gameId placeholder
  const resolveRoute = useCallback((route) => {
    if (route.includes(':gameId') && demoGameId) {
      return route.replace(':gameId', demoGameId);
    }
    return route;
  }, [demoGameId]);

  // Find and measure the target element
  const measureTarget = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector(currentStep.selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
      if (currentStep.scrollTo) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      setTargetRect(null);
    }
  }, [currentStep]);

  // Navigate to step's route if needed
  useEffect(() => {
    if (!active || !currentStep) return;

    const targetRoute = resolveRoute(currentStep.route);
    if (location.pathname !== targetRoute) {
      setTransitioning(true);
      navigate(targetRoute);
    }
  }, [step, active, currentStep, resolveRoute, location.pathname, navigate]);

  // Measure target after route change settles
  useEffect(() => {
    if (!active || !currentStep) return;

    // Wait for DOM to render after navigation
    const timer = setTimeout(() => {
      measureTarget();
      setTransitioning(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [step, active, location.pathname, measureTarget, currentStep]);

  // Re-measure on scroll/resize
  useEffect(() => {
    if (!active) return;
    const handleUpdate = () => measureTarget();
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [active, measureTarget]);

  // Create demo game when needed
  const createDemoGame = useCallback(async () => {
    if (demoGameId) return demoGameId;
    try {
      const response = await gameApi.createGame({
        hostUsername: 'Demo',
        theme: 'runway',
        budget: 5000,
        maxPlayers: 4,
        timeLimit: 300,
        singlePlayer: true,
      });
      const { game, player } = response.data;
      setGame(game);
      setCurrentPlayer(player);
      await gameApi.startGame(game.gameId);
      setDemoGameId(game.gameId);
      return game.gameId;
    } catch (err) {
      console.error('Failed to create demo game:', err);
      return null;
    }
  }, [demoGameId, setGame, setCurrentPlayer]);

  const handleNext = async () => {
    if (step >= totalSteps - 1) {
      onClose();
      return;
    }

    const nextStep = TOUR_STEPS[step + 1];

    // If next step needs a game, create one
    if (nextStep.route.includes(':gameId') && !demoGameId) {
      setTransitioning(true);
      const id = await createDemoGame();
      if (!id) {
        onClose();
        return;
      }
      setTransitioning(false);
    }

    setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(s => s - 1);
  };

  const handleSkip = () => {
    onClose();
    navigate('/');
  };

  if (!active || !currentStep) return null;

  // Calculate tooltip position
  const getTooltipStyle = () => {
    if (!targetRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const pad = 16;
    const pos = currentStep.position;

    if (pos === 'bottom') {
      return {
        top: `${targetRect.top + targetRect.height + pad}px`,
        left: `${targetRect.left + targetRect.width / 2}px`,
        transform: 'translateX(-50%)',
      };
    }
    if (pos === 'top') {
      return {
        top: `${targetRect.top - pad}px`,
        left: `${targetRect.left + targetRect.width / 2}px`,
        transform: 'translate(-50%, -100%)',
      };
    }
    if (pos === 'left') {
      return {
        top: `${targetRect.top + targetRect.height / 2}px`,
        left: `${targetRect.left - pad}px`,
        transform: 'translate(-100%, -50%)',
      };
    }
    if (pos === 'right') {
      return {
        top: `${targetRect.top + targetRect.height / 2}px`,
        left: `${targetRect.left + targetRect.width + pad}px`,
        transform: 'translateY(-50%)',
      };
    }

    return {};
  };

  return (
    <div className="tour-overlay">
      {/* Spotlight cutout using box-shadow trick */}
      {targetRect && (
        <div
          className="tour-spotlight"
          style={{
            top: `${targetRect.top - 8}px`,
            left: `${targetRect.left - 8}px`,
            width: `${targetRect.width + 16}px`,
            height: `${targetRect.height + 16}px`,
          }}
        />
      )}

      {/* Dark overlay with hole */}
      <svg className="tour-mask" width="100%" height="100%">
        <defs>
          <mask id="tour-hole">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - 8}
                y={targetRect.top - 8}
                width={targetRect.width + 16}
                height={targetRect.height + 16}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#tour-hole)"
        />
      </svg>

      {/* Tooltip */}
      {!transitioning && (
        <div className="tour-tooltip" style={getTooltipStyle()}>
          <div className="tour-tooltip-step">
            {step + 1} of {totalSteps}
          </div>
          <h3 className="tour-tooltip-title">{currentStep.title}</h3>
          <p className="tour-tooltip-desc">{currentStep.description}</p>
          <div className="tour-tooltip-nav">
            <button className="tour-skip-btn" onClick={handleSkip}>
              Skip Tour
            </button>
            <div className="tour-tooltip-buttons">
              {step > 0 && (
                <button className="tour-back-btn" onClick={handleBack}>
                  Back
                </button>
              )}
              <button className="tour-next-btn" onClick={handleNext}>
                {step === totalSteps - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>

          {/* Progress dots */}
          <div className="tour-dots">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`tour-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Loading state while transitioning */}
      {transitioning && (
        <div className="tour-loading">
          <div className="spinner" />
        </div>
      )}
    </div>
  );
}
