// In-Vehicle Alignment & Calibration Engine
// Estimates phone pitch/roll/yaw relative to vehicle forward axis
// Uses gravity + GNSS heading vector during straight motion

export interface CalibResult {
  pitch: number; // deg
  roll: number;
  yaw: number; // phone vs vehicle heading
  confidence: number; // 0-1
}

export function estimateAlignment(
  gravity: { x: number; y: number; z: number },
  gnssHeading: number, // deg 0-360
  magHeading: number // phone magnetic heading deg
): CalibResult {
  const g = gravity;
  const pitch = (Math.atan2(-g.x, Math.sqrt(g.y * g.y + g.z * g.z)) * 180) / Math.PI;
  const roll = (Math.atan2(g.y, g.z) * 180) / Math.PI;
  let yaw = magHeading - gnssHeading;
  // normalize -180..180
  yaw = ((yaw + 180) % 360) - 180;
  const confidence = 0.92; // placeholder: compute from variance in real impl
  return { pitch, roll, yaw, confidence };
}

export function rotationMatrixFromEuler(pitch: number, roll: number, yaw: number) {
  // deg -> rad
  const p = (pitch * Math.PI) / 180;
  const r = (roll * Math.PI) / 180;
  const y = (yaw * Math.PI) / 180;
  // simplified ZYX
  return { p, r, y };
}
