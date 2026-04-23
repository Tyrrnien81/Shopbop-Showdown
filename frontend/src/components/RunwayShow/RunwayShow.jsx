import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { SpotLight as VolumetricSpotLight } from '@react-three/drei';
import OutfitModel from './OutfitModel';
import Preloader from './Preloader';

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

function Scene({ outfit, startTimeRef, onOutfitReady, onOutfitDone }) {
  return (
    <>
      <color attach="background" args={['#0a0a0a']} />
      <fog attach="fog" args={['#0a0a0a', 8, 40]} />

      <ambientLight intensity={0.25} color="#1a1a1a" />

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
      {!ready && <Preloader />}
    </div>
  );
}
