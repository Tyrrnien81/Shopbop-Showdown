import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { SpotLight as VolumetricSpotLight, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import OutfitModel, { WALK_DURATION, POSE_DURATION, TOTAL_DURATION as WALK_PHASE_DURATION } from './OutfitModel';
import Preloader from './Preloader';
import Flashes from './Flashes';
import RunwayOverlays from './RunwayOverlays';

const POSE_START = WALK_DURATION;
const POSE_END = WALK_DURATION + POSE_DURATION;

// Sequencer phase durations (seconds)
const PRESHOW_DURATION = 2.0;
const DARK_PHASE_DURATION = 1.0;
const VOTE_NOW_DURATION = 1.5;
const TEXTURE_LOAD_TIMEOUT_MS = 10_000;

const AMBIENT_AUDIO_SRC = '/audio/runway-ambient.mp3';
const SHUTTER_AUDIO_SRC = '/audio/camera-shutter.mp3';

// Fisher–Yates shuffle (in-place on a copy). Uniform, unlike Array.sort(() => random).
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function Floor() {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, -12]} receiveShadow>
      <planeGeometry args={[3.5, 30]} />
      <meshStandardMaterial
        color="#1a1a1a"
        metalness={0.75}
        roughness={0.28}
        transparent
        opacity={0.72}
      />
    </mesh>
  );
}

function AimedSpotLight({ position, target, color, intensity, angle, penumbra, distance }) {
  const lightRef = useRef();
  useEffect(() => {
    const light = lightRef.current;
    if (!light) return;
    light.target.position.set(target[0], target[1], target[2]);
    light.target.updateMatrixWorld();
  }, [target]);
  return (
    <spotLight
      ref={lightRef}
      position={position}
      color={color}
      intensity={intensity}
      angle={angle}
      penumbra={penumbra}
      distance={distance}
      decay={1.5}
    />
  );
}

function BreathingKeyLight({ startTimeRef }) {
  const lightRef = useRef();
  useFrame(() => {
    const light = lightRef.current;
    const startTime = startTimeRef?.current;
    if (!light || !startTime) return;
    const elapsed = (performance.now() - startTime) / 1000;

    let boost = 1;
    if (elapsed >= POSE_START && elapsed < POSE_END) {
      const p = (elapsed - POSE_START) / (POSE_END - POSE_START);
      boost = 1 + 0.3 * Math.sin(p * Math.PI);
      light.color.setHex(0xffd9a8);
    } else {
      light.color.setHex(0xffe8d6);
    }
    light.intensity = 55 * boost;
  });
  return (
    <spotLight
      ref={lightRef}
      position={[0, 7, -4]}
      angle={0.55}
      penumbra={0.55}
      distance={18}
      intensity={55}
      color="#ffe8d6"
      decay={1.5}
    />
  );
}

function Scene({ texture, walkStartTimeRef, onOutfitDone }) {
  return (
    <>
      <color attach="background" args={['#0a0a0a']} />
      <fog attach="fog" args={['#0a0a0a', 8, 40]} />
      <ambientLight intensity={0.25} color="#1a1a1a" />

      <BreathingKeyLight startTimeRef={walkStartTimeRef} />

      <VolumetricSpotLight
        position={[0, 7, -4]}
        angle={0.5}
        penumbra={0.55}
        distance={14}
        attenuation={6}
        anglePower={4}
        intensity={2.2}
        color="#ffe8d6"
      />
      <VolumetricSpotLight
        position={[0, 7, -14]}
        angle={0.55}
        penumbra={0.6}
        distance={14}
        attenuation={7}
        anglePower={4}
        intensity={1.4}
        color="#ffecd2"
      />

      <AimedSpotLight
        position={[-5, 4.5, -8]}
        target={[0, 0, -8]}
        color="#ffd9b0"
        intensity={45}
        angle={0.55}
        penumbra={0.7}
        distance={22}
      />
      <AimedSpotLight
        position={[5, 4.5, -8]}
        target={[0, 0, -8]}
        color="#ffd9b0"
        intensity={45}
        angle={0.55}
        penumbra={0.7}
        distance={22}
      />
      <AimedSpotLight
        position={[0, 3, -22]}
        target={[0, 1.5, -4]}
        color="#ffe0c0"
        intensity={25}
        angle={0.35}
        penumbra={0.8}
        distance={30}
      />

      <Floor />

      <Sparkles
        count={25}
        scale={[4, 4, 18]}
        position={[0, 2.2, -9]}
        size={1.2}
        speed={0.15}
        opacity={0.35}
        color="#fff3d0"
      />

      {texture && (
        <OutfitModel
          texture={texture}
          startTimeRef={walkStartTimeRef}
          onDone={onOutfitDone}
        />
      )}
    </>
  );
}

function VoteNowCard({ visible }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: 'none',
        zIndex: 6,
      }}
    >
      <h1
        style={{
          margin: 0,
          fontFamily: "'Playfair Display', serif",
          fontSize: 'clamp(40px, 6vw, 64px)',
          color: 'white',
          textTransform: 'uppercase',
          letterSpacing: '0.22em',
          fontWeight: 400,
        }}
      >
        Vote Now
      </h1>
    </div>
  );
}

function ProgressDots({ count, currentIndex, visible }) {
  if (count <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '8px',
        opacity: visible ? 0.75 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: 'none',
        zIndex: 8,
      }}
    >
      {Array.from({ length: count }).map((_, i) => {
        const isCurrent = i === currentIndex;
        const isPast = i < currentIndex;
        return (
          <span
            key={i}
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: isCurrent ? 'rgba(255, 255, 255, 0.95)' : isPast ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.18)',
              transition: 'background 0.3s ease',
            }}
          />
        );
      })}
    </div>
  );
}

export default function RunwayShow({ outfits = [], theme = '', onComplete = () => {} }) {
  // Per-outfit preloaded playlist: [{ outfit, texture }, ...]
  const [playlist, setPlaylist] = useState(null);
  const [preloadMessage, setPreloadMessage] = useState('Preparing the runway…');
  const [muted, setMuted] = useState(false);

  // Sequencer phase: loading | preshow | walking | dark | voteNow | done
  const [phase, setPhase] = useState('loading');
  const [index, setIndex] = useState(0);

  const mutedRef = useRef(muted);
  const showStartTimeRef = useRef(null); // set when preshow begins, drives title card
  const walkStartTimeRef = useRef(null); // set when each walk begins, drives OutfitModel / Flashes / BreathingKeyLight
  const ambientAudioRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  const completeFiredRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  useEffect(() => {
    mutedRef.current = muted;
    if (ambientAudioRef.current) ambientAudioRef.current.muted = muted;
  }, [muted]);

  const fireComplete = useCallback(() => {
    if (completeFiredRef.current) return;
    completeFiredRef.current = true;
    onCompleteRef.current?.();
  }, []);

  // --- Preload textures before the show starts ---
  useEffect(() => {
    let cancelled = false;
    const valid = outfits.filter(o => o && o.tryOnImageUrl);
    if (valid.length === 0) {
      // Nothing to play — skip straight to voting.
      fireComplete();
      return () => {};
    }

    const shuffled = shuffle(valid);

    // If loading drags on, show a secondary message.
    const slowMessageTimer = setTimeout(() => {
      if (!cancelled) setPreloadMessage('Loading looks…');
    }, 3_000);

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    const loadOne = (outfit) =>
      new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          console.warn('Outfit texture timed out:', outfit.tryOnImageUrl);
          resolve({ outfit, texture: null });
        }, TEXTURE_LOAD_TIMEOUT_MS);
        loader.load(
          outfit.tryOnImageUrl,
          (tex) => {
            clearTimeout(timeoutId);
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = 8;
            resolve({ outfit, texture: tex });
          },
          undefined,
          (err) => {
            clearTimeout(timeoutId);
            console.warn('Outfit texture failed:', outfit.tryOnImageUrl, err);
            resolve({ outfit, texture: null });
          },
        );
      });

    Promise.all(shuffled.map(loadOne)).then((results) => {
      if (cancelled) return;
      const playable = results.filter(r => r.texture);
      if (playable.length === 0) {
        fireComplete();
        return;
      }
      setPlaylist(playable);
    });

    return () => {
      cancelled = true;
      clearTimeout(slowMessageTimer);
    };
    // Eslint-disable: we intentionally recompute only when outfits identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outfits]);

  // --- Kick off the sequencer once the playlist is loaded ---
  useEffect(() => {
    if (!playlist || phase !== 'loading') return;
    showStartTimeRef.current = performance.now();
    setPhase('preshow');
  }, [playlist, phase]);

  // --- Phase transitions driven by setTimeout ---
  useEffect(() => {
    if (!playlist) return;
    let timer;

    if (phase === 'preshow') {
      timer = setTimeout(() => {
        walkStartTimeRef.current = performance.now();
        setPhase('walking');
      }, PRESHOW_DURATION * 1000);
    } else if (phase === 'walking') {
      timer = setTimeout(() => {
        setPhase('dark');
      }, WALK_PHASE_DURATION * 1000);
    } else if (phase === 'dark') {
      timer = setTimeout(() => {
        if (index + 1 >= playlist.length) {
          setPhase('voteNow');
        } else {
          setIndex(i => i + 1);
          walkStartTimeRef.current = performance.now();
          setPhase('walking');
        }
      }, DARK_PHASE_DURATION * 1000);
    } else if (phase === 'voteNow') {
      timer = setTimeout(() => {
        setPhase('done');
        fireComplete();
      }, VOTE_NOW_DURATION * 1000);
    }

    return () => timer && clearTimeout(timer);
  }, [phase, index, playlist, fireComplete]);

  // --- Ambient audio lifecycle (starts with preshow) ---
  useEffect(() => {
    if (phase === 'loading' || phase === 'done') return;
    if (ambientAudioRef.current) return;
    const audio = new Audio(AMBIENT_AUDIO_SRC);
    audio.loop = true;
    audio.volume = 0.3;
    audio.muted = mutedRef.current;
    audio.play().catch((err) => {
      console.warn('Runway ambient audio did not start:', err?.message || err);
    });
    ambientAudioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = '';
      ambientAudioRef.current = null;
    };
  }, [phase]);

  const playShutter = useCallback(() => {
    if (mutedRef.current) return;
    try {
      const audio = new Audio(SHUTTER_AUDIO_SRC);
      audio.volume = 0.1 + Math.random() * 0.2;
      const p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      /* ignored */
    }
  }, []);

  // --- Render ---
  const current = playlist?.[index];
  const isLoading = phase === 'loading';
  const isDark = phase === 'dark';
  const showingFlashes = phase === 'walking';
  const showingOverlays = phase !== 'loading' && phase !== 'done';

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#0a0a0a',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 2.4, 6], fov: 40, near: 0.1, far: 80 }}
        gl={{ antialias: true, toneMappingExposure: 0.9 }}
      >
        <Suspense fallback={null}>
          <Scene
            // Render a fresh OutfitModel per outfit so animation state resets cleanly.
            key={`outfit-${index}-${phase === 'walking' ? 'live' : 'idle'}`}
            texture={phase === 'walking' && current ? current.texture : null}
            walkStartTimeRef={walkStartTimeRef}
            onOutfitDone={() => {
              // WALK_PHASE_DURATION setTimeout also advances the phase; this callback
              // is defensive in case the wall-clock elapses slightly earlier.
            }}
          />
        </Suspense>
      </Canvas>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, rgba(0,0,0,0) 38%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* Dark transition: soft fade-to-black between outfits */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#0a0a0a',
          opacity: isDark ? 0.85 : 0,
          transition: 'opacity 0.4s ease',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {showingFlashes && current && (
        <Flashes
          key={`flashes-${index}`}
          startTimeRef={walkStartTimeRef}
          onShutter={playShutter}
        />
      )}

      {showingOverlays && current && (
        <RunwayOverlays
          showStartTimeRef={showStartTimeRef}
          walkStartTimeRef={walkStartTimeRef}
          theme={theme}
          outfit={phase === 'walking' ? current.outfit : null}
          outfitCount={playlist?.length || 0}
        />
      )}

      <VoteNowCard visible={phase === 'voteNow'} />

      <ProgressDots
        count={playlist?.length || 0}
        currentIndex={index}
        visible={phase === 'walking' || phase === 'dark' || phase === 'voteNow'}
      />

      {!isLoading && (
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Unmute sound' : 'Mute sound'}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '50%',
            color: 'rgba(255, 255, 255, 0.85)',
            cursor: 'pointer',
            zIndex: 10,
            backdropFilter: 'blur(4px)',
          }}
        >
          {muted ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          )}
        </button>
      )}

      {!isLoading && (
        <button
          type="button"
          onClick={fireComplete}
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: 'rgba(255, 255, 255, 0.55)',
            padding: '6px 16px',
            borderRadius: '999px',
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '11px',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            zIndex: 10,
          }}
        >
          Skip
        </button>
      )}

      {isLoading && <Preloader message={preloadMessage} />}
    </div>
  );
}
