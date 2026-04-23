import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { SpotLight as VolumetricSpotLight, Sparkles } from '@react-three/drei';
import OutfitModel, { WALK_DURATION, POSE_DURATION } from './OutfitModel';
import Preloader from './Preloader';
import Flashes from './Flashes';

const POSE_START = WALK_DURATION;
const POSE_END = WALK_DURATION + POSE_DURATION;

function Floor() {
  // Slightly transparent so the floor reflection below y=0 is visible through the glossy surface.
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

// Illumination spotlight paired with the overhead volumetric cone.
// Its intensity breathes up during the pose moment, which feels like a
// photographer's strobe catching on for the hero shot.
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
      boost = 1 + 0.3 * Math.sin(p * Math.PI); // smooth pulse up and back
    }
    light.intensity = 55 * boost;
    // Slight warm shift during the pose for a subtle hero-light feel
    if (elapsed >= POSE_START && elapsed < POSE_END) {
      light.color.setHex(0xffd9a8);
    } else {
      light.color.setHex(0xffe8d6);
    }
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

function Scene({ outfit, startTimeRef, onOutfitReady, onOutfitDone }) {
  return (
    <>
      <color attach="background" args={['#0a0a0a']} />
      <fog attach="fog" args={['#0a0a0a', 8, 40]} />

      <ambientLight intensity={0.25} color="#1a1a1a" />

      <BreathingKeyLight startTimeRef={startTimeRef} />

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

      {/* Dust motes drifting through the spotlight pools — subconscious atmosphere */}
      <Sparkles
        count={25}
        scale={[4, 4, 18]}
        position={[0, 2.2, -9]}
        size={1.2}
        speed={0.15}
        opacity={0.35}
        color="#fff3d0"
      />

      {outfit && (
        <OutfitModel
          outfit={outfit}
          startTimeRef={startTimeRef}
          onReady={onOutfitReady}
          onDone={onOutfitDone}
        />
      )}
    </>
  );
}

export default function RunwayShow({ outfits = [], theme = '', onComplete = () => {} }) {
  void theme;

  const [ready, setReady] = useState(false);
  const startTimeRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Stage 2: single outfit only — we'll grow this into a multi-outfit sequencer later.
  const outfit = outfits[0];

  // No outfit → skip the show entirely.
  useEffect(() => {
    if (outfits.length > 0 && !outfits[0]?.tryOnImageUrl) {
      onCompleteRef.current();
      return;
    }
    if (outfits.length === 0) {
      onCompleteRef.current();
    }
  }, [outfits]);

  const handleOutfitReady = useCallback(() => {
    if (startTimeRef.current) return;
    startTimeRef.current = performance.now();
    setReady(true);
  }, []);

  const handleOutfitDone = useCallback(() => {
    onCompleteRef.current();
  }, []);

  if (!outfit) return null;

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
            outfit={outfit}
            startTimeRef={startTimeRef}
            onOutfitReady={handleOutfitReady}
            onOutfitDone={handleOutfitDone}
          />
        </Suspense>
      </Canvas>

      {/* Vignette — focuses attention centre-frame */}
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

      {/* Camera flashes (DOM overlay; driven by the same clock as the walk) */}
      {ready && <Flashes startTimeRef={startTimeRef} />}

      {!ready && <Preloader />}
    </div>
  );
}
