import { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Walk → pose → exit, in seconds. Exported so the orchestrator can drive the total.
export const WALK_DURATION = 3.0;
export const POSE_DURATION = 1.0;
export const EXIT_DURATION = 1.0;
export const TOTAL_DURATION = WALK_DURATION + POSE_DURATION + EXIT_DURATION;

const START_Z = -12;
const FRONT_Z = 1.5;
const START_SCALE = 0.35;
const PLANE_HEIGHT = 2.8;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function OutfitModel({ outfit, startTimeRef, onReady, onDone }) {
  const [texture, setTexture] = useState(null);
  const [loadError, setLoadError] = useState(false);

  // Load texture manually (not via Suspense) so we can surface load events to the parent
  // for the preloader handoff without blocking the Canvas tree.
  useEffect(() => {
    if (!outfit?.tryOnImageUrl) {
      onReady?.();
      return () => {};
    }
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      console.warn('Outfit texture load timed out:', outfit.tryOnImageUrl);
      setLoadError(true);
      onReady?.();
    }, 10_000);

    loader.load(
      outfit.tryOnImageUrl,
      (tex) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        setTexture(tex);
        onReady?.();
      },
      undefined,
      (err) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        console.error('Failed to load outfit texture:', err);
        setLoadError(true);
        onReady?.();
      },
    );
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [outfit?.tryOnImageUrl, onReady]);

  const [planeWidth, planeHeight] = useMemo(() => {
    if (!texture?.image) return [PLANE_HEIGHT * (2 / 3), PLANE_HEIGHT];
    const aspect = texture.image.width / texture.image.height;
    return [PLANE_HEIGHT * aspect, PLANE_HEIGHT];
  }, [texture]);

  const meshRef = useRef();
  const reflectionRef = useRef();
  const matRef = useRef();
  const reflMatRef = useRef();
  const doneFiredRef = useRef(false);

  useFrame(() => {
    const startTime = startTimeRef?.current;
    const mesh = meshRef.current;
    const refl = reflectionRef.current;
    const mat = matRef.current;
    const reflMat = reflMatRef.current;
    if (!mesh || !mat || !startTime) return;

    const elapsed = (performance.now() - startTime) / 1000;

    if (elapsed >= TOTAL_DURATION) {
      mat.opacity = 0;
      if (reflMat) reflMat.opacity = 0;
      if (!doneFiredRef.current) {
        doneFiredRef.current = true;
        onDone?.();
      }
      return;
    }

    let z, scale, opacity, swayWeight;
    if (elapsed < WALK_DURATION) {
      // The approach: far → front, scaling up, lifting out of shadow
      const t = easeInOutCubic(elapsed / WALK_DURATION);
      z = THREE.MathUtils.lerp(START_Z, FRONT_Z, t);
      scale = THREE.MathUtils.lerp(START_SCALE, 1.0, t);
      opacity = THREE.MathUtils.lerp(0.35, 1.0, t);
      swayWeight = 1.0;
    } else if (elapsed < WALK_DURATION + POSE_DURATION) {
      // The pose: hold position, tiny scale pulse, sway damps to zero
      const p = (elapsed - WALK_DURATION) / POSE_DURATION;
      z = FRONT_Z;
      scale = 1.0 + 0.02 * Math.sin(p * Math.PI);
      opacity = 1.0;
      swayWeight = 1.0 - p;
    } else {
      // The exit: fade + subtle scale-back
      const e = (elapsed - WALK_DURATION - POSE_DURATION) / EXIT_DURATION;
      z = FRONT_Z;
      scale = THREE.MathUtils.lerp(1.02, 0.98, e);
      opacity = Math.max(0, 1 - e * 1.2);
      swayWeight = 0;
    }

    // Sinusoidal sway — confident walk, not a wobble
    const swayFreq = 2.0;
    const swayX = Math.sin(elapsed * Math.PI * swayFreq) * 0.06 * swayWeight;
    const swayRotY = Math.sin(elapsed * Math.PI * swayFreq) * 0.008 * swayWeight;

    const yCenter = planeHeight / 2 + 0.08;
    mesh.position.set(swayX, yCenter, z);
    mesh.scale.setScalar(scale);
    mesh.rotation.y = swayRotY;
    mat.opacity = opacity;

    // Floor reflection: mirror the plane's position in Y, flip vertically via negative scale-y.
    if (refl && reflMat) {
      refl.position.set(swayX, -yCenter, z);
      refl.scale.set(scale, -scale, scale);
      refl.rotation.y = swayRotY;
      reflMat.opacity = opacity * 0.25;
    }
  });

  if (!texture || loadError) return null;

  return (
    <>
      <mesh ref={meshRef} renderOrder={2}>
        <planeGeometry args={[planeWidth, planeHeight]} />
        <meshBasicMaterial
          ref={matRef}
          map={texture}
          transparent
          opacity={0}
          toneMapped={false}
          alphaTest={0.02}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={reflectionRef} renderOrder={1}>
        <planeGeometry args={[planeWidth, planeHeight]} />
        <meshBasicMaterial
          ref={reflMatRef}
          map={texture}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}
