import { useEffect, useRef, useState } from 'react';
import { TOTAL_DURATION, WALK_DURATION, POSE_DURATION } from './OutfitModel';

// Phase boundaries (seconds into the show)
const POSE_START = WALK_DURATION;                 // 3.0
const EXIT_START = WALK_DURATION + POSE_DURATION; // 4.0

const MAX_CONCURRENT = 6;

function randBetween(a, b) {
  return a + Math.random() * (b - a);
}

export default function Flashes({ startTimeRef, onShutter }) {
  const [flashes, setFlashes] = useState([]);
  const [bounceAlpha, setBounceAlpha] = useState(0);
  const idRef = useRef(0);
  const onShutterRef = useRef(onShutter);
  useEffect(() => {
    onShutterRef.current = onShutter;
  }, [onShutter]);

  useEffect(() => {
    let mounted = true;

    // Shared: create a flash, briefly raise opacity via state machine, then remove.
    function fireFlash(big = false) {
      if (!mounted) return;
      const id = ++idRef.current;
      const x = randBetween(5, 95);
      const y = randBetween(10, 80);
      const size = big ? randBetween(80, 160) : randBetween(40, 110);
      const peak = big ? randBetween(0.75, 0.95) : randBetween(0.55, 0.85);

      setFlashes(prev => {
        const next = [...prev, { id, x, y, size, peak, opacity: 0 }];
        // Hard cap on concurrent flashes for perf on low-end laptops.
        return next.length > MAX_CONCURRENT ? next.slice(-MAX_CONCURRENT) : next;
      });
      setBounceAlpha(0.04);
      onShutterRef.current?.();

      // Peak
      setTimeout(() => {
        if (!mounted) return;
        setFlashes(prev => prev.map(f => (f.id === id ? { ...f, opacity: peak } : f)));
      }, 15);
      // Decay
      setTimeout(() => {
        if (!mounted) return;
        setFlashes(prev => prev.map(f => (f.id === id ? { ...f, opacity: 0 } : f)));
        setBounceAlpha(0);
      }, 70);
      // Remove from DOM
      setTimeout(() => {
        if (!mounted) return;
        setFlashes(prev => prev.filter(f => f.id !== id));
      }, 180);
    }

    let nextWalkFlash = 0;
    let nextExitFlash = 0;
    let poseFired = false;

    const poll = setInterval(() => {
      if (!mounted) return;
      const startTime = startTimeRef?.current;
      if (!startTime) return;
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed < 0 || elapsed >= TOTAL_DURATION) return;
      const now = performance.now();

      if (elapsed < POSE_START) {
        // Walk: steady paparazzi every 0.5–2s
        if (nextWalkFlash === 0) nextWalkFlash = now + randBetween(300, 900);
        if (now >= nextWalkFlash) {
          fireFlash(false);
          nextWalkFlash = now + randBetween(500, 2000);
        }
      } else if (elapsed < EXIT_START) {
        // Pose: single burst of 4 rapid big flashes, then silence until exit
        if (!poseFired) {
          poseFired = true;
          [0, 130, 260, 390].forEach((d) => {
            setTimeout(() => fireFlash(true), d + Math.random() * 60);
          });
        }
      } else {
        // Exit: tapering
        if (nextExitFlash === 0) nextExitFlash = now + randBetween(500, 1200);
        if (now >= nextExitFlash) {
          fireFlash(false);
          nextExitFlash = now + randBetween(1500, 3000);
        }
      }
    }, 80);

    return () => {
      mounted = false;
      clearInterval(poll);
    };
  }, [startTimeRef]);

  return (
    <>
      {/* Full-viewport ambient bounce — simulates the room lighting up from each flash */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'white',
          opacity: bounceAlpha,
          mixBlendMode: 'screen',
          transition: 'opacity 0.1s ease-out',
          pointerEvents: 'none',
          zIndex: 3,
        }}
      />
      {/* Individual camera flashes */}
      {flashes.map(f => (
        <div
          key={f.id}
          style={{
            position: 'absolute',
            left: `${f.x}%`,
            top: `${f.y}%`,
            width: `${f.size}px`,
            height: `${f.size}px`,
            borderRadius: '50%',
            background: 'white',
            opacity: f.opacity,
            transform: 'translate(-50%, -50%)',
            filter: 'blur(3px)',
            boxShadow: `0 0 ${f.size / 1.8}px rgba(255, 255, 255, 0.9)`,
            transition: 'opacity 0.06s ease-out',
            pointerEvents: 'none',
            zIndex: 4,
          }}
        />
      ))}
    </>
  );
}
