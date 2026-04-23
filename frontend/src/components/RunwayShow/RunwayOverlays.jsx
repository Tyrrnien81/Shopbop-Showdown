import { useEffect, useState } from 'react';
import { WALK_DURATION, POSE_DURATION } from './OutfitModel';

// Pre-show timing (matches PRESHOW_DURATION in RunwayShow)
const TITLE_HOLD_UNTIL = 1.5; // seconds into pre-show when title starts fading out

const textStyleBase = {
  margin: 0,
  color: 'white',
  pointerEvents: 'none',
};

export default function RunwayOverlays({ showStartTimeRef, walkStartTimeRef, theme, outfit, outfitCount }) {
  const [titleVisible, setTitleVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    const interval = setInterval(() => {
      if (!mounted) return;
      const showStart = showStartTimeRef?.current;
      const walkStart = walkStartTimeRef?.current;

      // Title card: visible from t=0 to t=TITLE_HOLD_UNTIL of the pre-show clock.
      // CSS transition handles the fade-in/out symmetrically (0.5s).
      if (showStart) {
        const t = (performance.now() - showStart) / 1000;
        setTitleVisible(t >= 0 && t < TITLE_HOLD_UNTIL);
      }

      // Per-outfit card: visible during the pose window (seconds 3–4 of the walk).
      if (walkStart) {
        const t = (performance.now() - walkStart) / 1000;
        setInfoVisible(t >= WALK_DURATION && t < WALK_DURATION + POSE_DURATION);
      } else {
        setInfoVisible(false);
      }
    }, 60);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [showStartTimeRef, walkStartTimeRef]);

  const lookWord = outfitCount === 1 ? 'look' : 'looks';
  const itemWord = outfit?.itemCount === 1 ? 'item' : 'items';

  return (
    <>
      {/* Pre-show title card */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: titleVisible ? 1 : 0,
          transition: 'opacity 0.5s ease',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        <h1
          style={{
            ...textStyleBase,
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(32px, 5vw, 56px)',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            fontWeight: 400,
          }}
        >
          {theme || 'The Show'}
        </h1>
        <p
          style={{
            ...textStyleBase,
            marginTop: '18px',
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '16px',
            color: 'rgba(255, 255, 255, 0.65)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          {outfitCount} {lookWord}. 1 winner.
        </p>
      </div>

      {/* Per-outfit info card (bottom center) */}
      {outfit && (
        <div
          style={{
            position: 'absolute',
            bottom: '12%',
            left: 0,
            right: 0,
            textAlign: 'center',
            opacity: infoVisible ? 1 : 0,
            transition: 'opacity 0.3s ease',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          <div
            style={{
              ...textStyleBase,
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(22px, 3vw, 32px)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 400,
            }}
          >
            {outfit.playerName || 'Contestant'}
          </div>
          <div
            style={{
              ...textStyleBase,
              marginTop: '6px',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.65)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            ${typeof outfit.totalCost === 'number' ? outfit.totalCost.toLocaleString() : outfit.totalCost} — {outfit.itemCount} {itemWord}
          </div>
        </div>
      )}
    </>
  );
}
