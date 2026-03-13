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
    position: 'top',
  },
];

// Wait for a selector to appear in the DOM, resolves immediately if already present
function waitForElement(selector, timeout = 3000) {
  return new Promise((resolve) => {
    const el = document.querySelector(selector);
    if (el) { resolve(el); return; }

    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) { observer.disconnect(); resolve(found); }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => { observer.disconnect(); resolve(document.querySelector(selector)); }, timeout);
  });
}

export default function GuidedTour({ active, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [demoGameId, setDemoGameId] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const rafRef = useRef(null);
  const { setGame, setCurrentPlayer } = useGameStore();

  const currentStep = TOUR_STEPS[step];
  const totalSteps = TOUR_STEPS.length;

  const resolveRoute = useCallback((route) => {
    if (route.includes(':gameId') && demoGameId) {
      return route.replace(':gameId', demoGameId);
    }
    return route;
  }, [demoGameId]);

  // Measure and spotlight a target element
  const measure = useCallback((el) => {
    if (!el) { setTargetRect(null); return; }
    const rect = el.getBoundingClientRect();
    setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
  }, []);

  // Core: navigate if needed, then wait for the element and measure it
  useEffect(() => {
    if (!active || !currentStep) return;
    let cancelled = false;

    const run = async () => {
      const targetRoute = resolveRoute(currentStep.route);
      const needsNav = location.pathname !== targetRoute;

      if (needsNav) {
        setTransitioning(true);
        navigate(targetRoute);
        // Give React one frame to start rendering the new route
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      }

      const el = await waitForElement(currentStep.selector);
      if (cancelled) return;

      if (el && currentStep.scrollTo) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Small delay for scroll to settle
        await new Promise(r => setTimeout(r, 120));
      }

      if (!cancelled) {
        measure(el);
        setTransitioning(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [step, active, currentStep, resolveRoute, location.pathname, navigate, measure]);

  // Re-measure on scroll/resize using rAF for smooth updates
  useEffect(() => {
    if (!active || !currentStep) return;

    const handleUpdate = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const el = document.querySelector(currentStep.selector);
        measure(el);
      });
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [active, currentStep, measure]);

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

    if (nextStep.route.includes(':gameId') && !demoGameId) {
      setTransitioning(true);
      const id = await createDemoGame();
      if (!id) { onClose(); return; }
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

  const getTooltipStyle = () => {
    if (!targetRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const pad = 16;
    const margin = 12; // min distance from viewport edge
    const tooltipW = 360;
    const tooltipH = 200; // approximate
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pos = currentStep.position;

    let top, left;

    if (pos === 'bottom') {
      top = targetRect.top + targetRect.height + pad;
      left = targetRect.left + targetRect.width / 2 - tooltipW / 2;
    } else if (pos === 'top') {
      top = targetRect.top - pad - tooltipH;
      left = targetRect.left + targetRect.width / 2 - tooltipW / 2;
    } else if (pos === 'left') {
      top = targetRect.top + targetRect.height / 2 - tooltipH / 2;
      left = targetRect.left - pad - tooltipW;
    } else if (pos === 'right') {
      top = targetRect.top + targetRect.height / 2 - tooltipH / 2;
      left = targetRect.left + targetRect.width + pad;
    }

    // Clamp to viewport
    left = Math.max(margin, Math.min(left, vw - tooltipW - margin));
    top = Math.max(margin, Math.min(top, vh - tooltipH - margin));

    return { top: `${top}px`, left: `${left}px` };
  };

  return (
    <div className="tour-overlay">
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

      {transitioning && (
        <div className="tour-loading">
          <div className="spinner" />
        </div>
      )}
    </div>
  );
}
