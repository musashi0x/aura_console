"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useReducedMotion } from "motion/react";
import * as THREE from "three";
import { cn } from "@/lib/utils";

export interface RavineProps {
  speed?: number;
  steps?: number;
  stepScale?: number;
  scale?: number;
  height?: number;
  spread?: number;
  wallCurve?: number;
  fade?: number;
  cameraHeight?: number;
  tilt?: number;
  roll?: number;
  fov?: number;
  nearColor?: string;
  farColor?: string;
  brightness?: number;
  contrast?: number;
  grain?: number;
  paused?: boolean;
  dpr?: number;
  className?: string;
  children?: ReactNode;
}

const MAX_STEPS = 256;

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

#define MAX_STEPS ${MAX_STEPS}
#define HIT_EPSILON 0.001

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform int uSteps;
uniform float uStepScale;
uniform float uScale;
uniform float uHeight;
uniform float uSpread;
uniform float uWallCurve;
uniform float uFade;
uniform float uCameraHeight;
uniform float uTilt;
uniform float uRoll;
uniform float uFov;
uniform vec3 uNear;
uniform vec3 uFar;
uniform float uBrightness;
uniform float uContrast;
uniform float uGrain;

const mat2 OCTAVE_TWIST = mat2(0.8, 0.6, -0.6, 0.8);

mat2 rotate(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

float ripple(vec2 p) {
  return sin(1.5 * p.x) * sin(1.5 * p.y);
}

void octave(inout vec2 p, inout float sum, float amplitude, float zoom) {
  sum += amplitude * (0.5 + 0.5 * ripple(p));
  p = OCTAVE_TWIST * p * zoom;
}

float terrainNoise(vec2 p) {
  float sum = 0.0;
  octave(p, sum, 0.5, 2.02);
  octave(p, sum, 0.25, 2.03);
  octave(p, sum, 0.125, 2.01);
  octave(p, sum, 0.0625, 2.04);
  sum += 0.015625 * (0.5 + 0.5 * ripple(p));
  return sum / 0.96875;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float canyon(vec3 p) {
  vec3 q = p + vec3(0.0, 0.0, uTime);
  float relief = terrainNoise(q.xz * uScale) * uHeight;
  float wall = pow(abs(q.x) * uSpread, uWallCurve) * 0.0000125;
  return max(q.y - relief * wall, 0.0);
}

float scene(vec3 p) {
  return canyon(p);
}

void main() {
  vec2 frag = vUv * uResolution;
  vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;

  vec3 origin = vec3(uv + vec2(0.0, uCameraHeight), -1.0);
  vec3 dir = normalize(vec3(uv * uFov, 1.0));
  dir.zy = rotate(uTilt) * dir.zy;
  dir.xy = rotate(uRoll) * dir.xy;

  vec3 p = origin;
  int taken = 0;
  for (int i = 0; i < MAX_STEPS; i++) {
    if (i >= uSteps) break;
    taken = i;
    float jitter = (hash(p.xz) - 0.5) * uGrain;
    float d = scene(p + vec3(jitter));
    if (d < HIT_EPSILON) break;
    p += dir * d * uStepScale;
  }

  float tone = float(taken) / float(MAX_STEPS);
  tone = (tone - 0.5) * uContrast + 0.5;
  tone = clamp(tone * uBrightness, 0.0, 1.0);
  if (uFade > 0.0) {
    float travelled = distance(origin, p) / uFade;
    tone *= exp(-travelled * travelled);
  }

  gl_FragColor = vec4(mix(uNear, uFar, tone), 1.0);
}
`;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const makeColor = (value: string, fallback: string) => {
  const color = new THREE.Color();
  try {
    color.setStyle(value, THREE.LinearSRGBColorSpace);
  } catch {
    color.setStyle(fallback, THREE.LinearSRGBColorSpace);
  }
  return color;
};

const updateColor = (target: THREE.Color, value: string) => {
  try {
    target.setStyle(value, THREE.LinearSRGBColorSpace);
  } catch {
    // Ignore invalid color string format
  }
};

const subscribeToDpr = (notify: () => void) => {
  if (typeof window === "undefined") return () => {};
  const media = window.matchMedia("(min-resolution: 2dppx)");
  media.addEventListener("change", notify);
  window.addEventListener("resize", notify);
  return () => {
    media.removeEventListener("change", notify);
    window.removeEventListener("resize", notify);
  };
};

const readDpr = () =>
  typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;

const subscribeNoop = () => () => {};

const checkWebGLSupport = () => {
  if (typeof window === "undefined" || typeof ResizeObserver === "undefined") {
    return false;
  }
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") ||
          canvas.getContext("webgl") ||
          canvas.getContext("experimental-webgl")),
    );
  } catch {
    return false;
  }
};

interface CanyonProps {
  speed: number;
  steps: number;
  stepScale: number;
  scale: number;
  height: number;
  spread: number;
  wallCurve: number;
  fade: number;
  cameraHeight: number;
  tilt: number;
  roll: number;
  fov: number;
  nearColor: string;
  farColor: string;
  brightness: number;
  contrast: number;
  grain: number;
  paused: boolean;
}

const Canyon = ({
  speed,
  steps,
  stepScale,
  scale,
  height,
  spread,
  wallCurve,
  fade,
  cameraHeight,
  tilt,
  roll,
  fov,
  nearColor,
  farColor,
  brightness,
  contrast,
  grain,
  paused,
}: CanyonProps) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const elapsed = useRef(0);
  const { gl, size, invalidate } = useThree();
  const uniforms = useMemo(
    () => ({
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uSteps: { value: 128 },
      uStepScale: { value: 0.5 },
      uScale: { value: 0.25 },
      uHeight: { value: 1 },
      uSpread: { value: 34 },
      uWallCurve: { value: 2.5 },
      uFade: { value: 35 },
      uCameraHeight: { value: 6 },
      uTilt: { value: 0.05 },
      uRoll: { value: 0.075 },
      uFov: { value: 1 },
      uNear: { value: makeColor("#000000", "#000000") },
      uFar: { value: makeColor("#ffffff", "#ffffff") },
      uBrightness: { value: 0.8 },
      uContrast: { value: 1 },
      uGrain: { value: 0.005 },
    }),
    [],
  );

  useEffect(() => {
    const material = materialRef.current;
    if (!material || !material.uniforms) return;
    if (material.uniforms.uNear) updateColor(material.uniforms.uNear.value, nearColor);
    if (material.uniforms.uFar) updateColor(material.uniforms.uFar.value, farColor);
    invalidate();
  }, [nearColor, farColor, invalidate]);

  useEffect(() => {
    invalidate();
  }, [
    steps,
    stepScale,
    scale,
    height,
    spread,
    wallCurve,
    fade,
    cameraHeight,
    tilt,
    roll,
    fov,
    brightness,
    contrast,
    grain,
    invalidate,
  ]);

  useFrame((_, delta) => {
    const material = materialRef.current;
    if (!material || !material.uniforms) return;
    if (!paused) elapsed.current += Math.min(delta, 0.05) * speed * 2.5;
    const pixelRatio = gl.getPixelRatio();
    const values = material.uniforms;
    if (values.uResolution) {
      values.uResolution.value.set(
        size.width * pixelRatio,
        size.height * pixelRatio,
      );
    }
    if (values.uTime) values.uTime.value = elapsed.current;
    if (values.uSteps) values.uSteps.value = Math.round(clamp(steps, 32, MAX_STEPS));
    if (values.uStepScale) values.uStepScale.value = clamp(stepScale, 0.1, 1);
    if (values.uScale) values.uScale.value = Math.max(scale, 0.01);
    if (values.uHeight) values.uHeight.value = height;
    if (values.uSpread) values.uSpread.value = Math.max(spread, 0);
    if (values.uWallCurve) values.uWallCurve.value = Math.max(wallCurve, 0.5);
    if (values.uFade) values.uFade.value = Math.max(fade, 0);
    if (values.uCameraHeight) values.uCameraHeight.value = cameraHeight;
    if (values.uTilt) values.uTilt.value = tilt;
    if (values.uRoll) values.uRoll.value = roll;
    if (values.uFov) values.uFov.value = Math.max(fov, 0.1);
    if (values.uBrightness) values.uBrightness.value = Math.max(brightness, 0);
    if (values.uContrast) values.uContrast.value = Math.max(contrast, 0);
    if (values.uGrain) values.uGrain.value = Math.max(grain, 0);
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
};

export const Ravine = ({
  speed = 1,
  steps = 128,
  stepScale = 0.5,
  scale = 0.25,
  height = 1,
  spread = 34,
  wallCurve = 2.5,
  fade = 35,
  cameraHeight = 6,
  tilt = 0.05,
  roll = 0.075,
  fov = 1,
  nearColor = "#000000",
  farColor = "#ffffff",
  brightness = 0.8,
  contrast = 1,
  grain = 0.005,
  paused = false,
  dpr = 1,
  className,
  children,
}: RavineProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const hasWebGL = useSyncExternalStore(subscribeNoop, checkWebGLSupport, () => false);
  const reducedMotion = useReducedMotion();
  const deviceDpr = useSyncExternalStore(subscribeToDpr, readDpr, () => 1);
  const pixelRatio = Math.min(deviceDpr, Math.max(dpr, 0.5));

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]) setVisible(entries[0].isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const still = paused || Boolean(reducedMotion);

  return (
    <div ref={rootRef} className={cn("relative overflow-hidden bg-[#0a0a0a]", className)}>
      {hasWebGL && (
        <div className="absolute inset-0">
          <Canvas
            orthographic
            dpr={pixelRatio}
            frameloop={visible && !still ? "always" : "demand"}
            gl={{
              antialias: false,
              alpha: false,
              powerPreference: "high-performance",
            }}
          >
            <Canyon
              speed={speed}
              steps={steps}
              stepScale={stepScale}
              scale={scale}
              height={height}
              spread={spread}
              wallCurve={wallCurve}
              fade={fade}
              cameraHeight={cameraHeight}
              tilt={tilt}
              roll={roll}
              fov={fov}
              nearColor={nearColor}
              farColor={farColor}
              brightness={brightness}
              contrast={contrast}
              grain={grain}
              paused={still}
            />
          </Canvas>
        </div>
      )}
      {children ? (
        <div className="relative z-10 h-full w-full">{children}</div>
      ) : null}
    </div>
  );
};

export default Ravine;
