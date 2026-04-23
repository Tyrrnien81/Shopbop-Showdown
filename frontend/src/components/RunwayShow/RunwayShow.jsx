import { Suspense, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { SpotLight as VolumetricSpotLight } from '@react-three/drei';

function Floor() {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, -12]} receiveShadow>
      <planeGeometry args={[3.5, 30]} />
      <meshStandardMaterial color="#1a1a1a" metalness={0.75} roughness={0.28} />
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

function Scene() {
  return (
    <>
      <color attach="background" args={['#0a0a0a']} />
      <fog attach="fog" args={['#0a0a0a', 8, 40]} />

      {/* Barely-there ambient so geometry isn't pure black */}
      <ambientLight intensity={0.25} color="#1a1a1a" />

      {/* Main overhead volumetric cone — creates the signature light column */}
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

      {/* Secondary volumetric cone further down the runway for depth */}
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

      {/* Warm side fills — aimed at the runway centre so they form soft pools */}
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

      {/* Back rim light to outline whatever walks into frame later */}
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
    </>
  );
}

export default function RunwayShow({ outfits = [], theme = '', onComplete = () => {} }) {
  // Props reserved for later stages; reference them so the linter/contract is clear.
  void outfits; void theme; void onComplete;

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a', overflow: 'hidden' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 2.4, 6], fov: 40, near: 0.1, far: 80 }}
        gl={{ antialias: true, toneMappingExposure: 0.9 }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
