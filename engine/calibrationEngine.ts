import { Sample3, RingBuffer } from "./buffer";

export interface CalibSample {
  gravity: Sample3;
  gnssHeading: number;
  magHeading: number;
  speed: number;
}

export interface CalibEngineState {
  buf: CalibSample[];
  running: boolean;
  progress: number; // 0-1
  result: { pitch: number; roll: number; yaw: number; confidence: number } | null;
  gravityRing: RingBuffer; // for live tilt
  lastShiftDetectAt: number;
}

export function createCalibEngine(): CalibEngineState {
  return {
    buf: [],
    running: false,
    progress: 0,
    result: null,
    gravityRing: new RingBuffer(64),
    lastShiftDetectAt: 0,
  };
}

// push live accel for gravity low-pass
export function pushGravity(state: CalibEngineState, acc: Sample3) {
  state.gravityRing.push(acc);
}

export function getLiveGravity(state: CalibEngineState): Sample3 {
  const arr = state.gravityRing.toArray();
  if (arr.length === 0) return { x: 0, y: 0, z: 9.81, t: Date.now() };
  let sx = 0, sy = 0, sz = 0;
  for (const s of arr) {
    sx += s.x; sy += s.y; sz += s.z;
  }
  return { x: sx / arr.length, y: sy / arr.length, z: sz / arr.length, t: Date.now() };
}

export function liveTilt(state: CalibEngineState): { pitch: number; roll: number } {
  const g = getLiveGravity(state);
  const pitch = (Math.atan2(-g.x, Math.sqrt(g.y * g.y + g.z * g.z)) * 180) / Math.PI;
  const roll = (Math.atan2(g.y, g.z) * 180) / Math.PI;
  return { pitch, roll };
}

export function collectSample(state: CalibEngineState, s: CalibSample) {
  if (!state.running) return;
  // only collect when moving straight: speed >2 m/s and low gyro assumed via heading stable
  if (s.speed < 2.0) return;
  state.buf.push(s);
  // progress based on desired 40 samples (~5s @ 8Hz collect)
  state.progress = Math.min(1, state.buf.length / 40);
}

export function computeResult(state: CalibEngineState) {
  if (state.buf.length < 10) return null;
  // average gravity
  let gx = 0, gy = 0, gz = 0;
  let gnssH = 0, magH = 0;
  for (const s of state.buf) {
    gx += s.gravity.x; gy += s.gravity.y; gz += s.gravity.z;
    gnssH += s.gnssHeading; magH += s.magHeading;
  }
  const n = state.buf.length;
  gx /= n; gy /= n; gz /= n;
  gnssH /= n; magH /= n;

  const pitch = (Math.atan2(-gx, Math.sqrt(gy * gy + gz * gz)) * 180) / Math.PI;
  const roll = (Math.atan2(gy, gz) * 180) / Math.PI;
  let yaw = magH - gnssH;
  yaw = ((yaw + 180) % 360) - 180;

  // confidence from variance
  let varG = 0, varYaw = 0;
  for (const s of state.buf) {
    varG += (s.gravity.x - gx) ** 2 + (s.gravity.y - gy) ** 2 + (s.gravity.z - gz) ** 2;
    const dy = ((s.magHeading - s.gnssHeading - yaw + 540) % 360) - 180;
    varYaw += dy * dy;
  }
  varG /= n; varYaw /= n;
  const confG = Math.max(0, 1 - varG / 4);
  const confYaw = Math.max(0, 1 - varYaw / 400);
  const confidence = Math.min(0.97, (confG * 0.5 + confYaw * 0.5));

  state.result = { pitch, roll, yaw, confidence };
  return state.result;
}

export function detectMountShift(state: CalibEngineState, gyroYaw: number, thresh = 1.2): boolean {
  if (Math.abs(gyroYaw) > thresh && Date.now() - state.lastShiftDetectAt > 3000) {
    state.lastShiftDetectAt = Date.now();
    return true;
  }
  return false;
}

export function resetCalib(state: CalibEngineState) {
  state.buf = [];
  state.progress = 0;
  state.result = null;
  state.running = false;
}
