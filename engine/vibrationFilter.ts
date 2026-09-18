import { Sample3 } from "./buffer";

export interface FilterState {
  // EMA for low-pass
  lpf: { x: number; y: number; z: number };
  // high freq residual
  hpf: { x: number; y: number; z: number };
  // pothole latch
  potholeCount: number;
  lastPotholeAt: number;
  vibeRms: number;
}

export interface FilterConfig {
  alphaLpf: number; // 0-1 low freq retention (0.1 = smooth)
  potholeThresh: number; // m/s² on Z spike
  engineRmsThresh: number; // vibration gate
  enableNotch: boolean;
}

const DEFAULT_CONFIG: FilterConfig = {
  alphaLpf: 0.12,
  potholeThresh: 12.5, // tuned for phone in mount hitting pothole
  engineRmsThresh: 2.8,
  enableNotch: true,
};

export function createFilterState(): FilterState {
  return {
    lpf: { x: 0, y: 0, z: 9.81 },
    hpf: { x: 0, y: 0, z: 0 },
    potholeCount: 0,
    lastPotholeAt: 0,
    vibeRms: 0,
  };
}

// single sample AI-style filter: EMA denoise + pothole gate + engine harmonic notch (alpha adaptive)
export function filterSample(
  raw: Sample3,
  state: FilterState,
  cfg: FilterConfig = DEFAULT_CONFIG
): { filtered: Sample3; isPothole: boolean; isVibration: boolean; gated: Sample3 } {
  const alpha = cfg.alphaLpf;

  // EMA low-pass
  state.lpf.x = alpha * raw.x + (1 - alpha) * state.lpf.x;
  state.lpf.y = alpha * raw.y + (1 - alpha) * state.lpf.y;
  state.lpf.z = alpha * raw.z + (1 - alpha) * state.lpf.z;

  // residual high-freq
  state.hpf.x = raw.x - state.lpf.x;
  state.hpf.y = raw.y - state.lpf.y;
  state.hpf.z = raw.z - state.lpf.z;

  const hMag = Math.sqrt(state.hpf.x ** 2 + state.hpf.y ** 2 + state.hpf.z ** 2);
  state.vibeRms = 0.2 * hMag + 0.8 * state.vibeRms;

  const isVibration = state.vibeRms > cfg.engineRmsThresh && Math.abs(raw.z - 9.81) < 1.0;

  // pothole = sharp Z spike + short duration
  const zSpike = Math.abs(raw.z - 9.81);
  const isPothole = zSpike > cfg.potholeThresh && Date.now() - state.lastPotholeAt > 600;
  if (isPothole) {
    state.potholeCount++;
    state.lastPotholeAt = Date.now();
  }

  // gated output: if pothole, clamp to lpf; if vibration, blend
  let gated: Sample3;
  if (isPothole) {
    // snap to low-pass to kill shock
    gated = { x: state.lpf.x, y: state.lpf.y, z: state.lpf.z, t: raw.t };
  } else if (isVibration && cfg.enableNotch) {
    // attenuate high freq by 70%
    gated = {
      x: state.lpf.x + state.hpf.x * 0.3,
      y: state.lpf.y + state.hpf.y * 0.3,
      z: state.lpf.z + state.hpf.z * 0.3,
      t: raw.t,
    };
  } else {
    gated = { x: state.lpf.x, y: state.lpf.y, z: state.lpf.z, t: raw.t };
    // For AI model stub: we output LPF as denoised forward accel
  }

  // expose filtered as gated for now; future TFLite would replace this block
  return { filtered: gated, isPothole, isVibration, gated };
}

// batch helper for 100Hz window -> 10Hz decimation
export function filterBatch(samples: Sample3[], state: FilterState, cfg?: FilterConfig) {
  let last: ReturnType<typeof filterSample> | null = null;
  let potholes = 0;
  let vibes = 0;
  for (const s of samples) {
    const r = filterSample(s, state, cfg);
    if (r.isPothole) potholes++;
    if (r.isVibration) vibes++;
    last = r;
  }
  return { last: last!, potholes, vibes, state };
}
