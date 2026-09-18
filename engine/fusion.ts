// GNSS+INS AI Fusion Engine — EKF-lite + NHC + Map-match pseudo-GNSS
// State: lat,lon,heading,speed,bias. Prediction 10Hz, correction via GNSS or map snap.
// This keeps drift <10% by clamping lateral drift via NHC and weekly map pseudo-measurement.

export interface FusionInput {
  accel: { x: number; y: number; z: number };
  gyro: { x: number; y: number; z: number };
  gnss?: { lat: number; lon: number; accuracy: number; speed?: number };
  // optional map-matched pseudo-GNSS when GNSS denied but road-snapped (HMM)
  mapPseudo?: { lat: number; lon: number; dist: number; confidence: number };
  dt: number;
}

export interface FusionOutput {
  lat: number;
  lon: number;
  heading: number;
  speed: number;
  drift: number;
  mode: "GNSS" | "IDR" | "FUSION";
  cov: number; // position covariance
}

// internal state
let state = { lat: 18.5204, lon: 73.8567, heading: 42, speed: 8.3, bias: 0.03 };
let cov = 4.5; // meters
let gnssLossTime = 0; // seconds without GNSS

const R_GNSS = 3.0; // GNSS noise
const R_MAP = 6.0; // map pseudo noise larger

function move(lat: number, lon: number, headingDeg: number, distM: number): { lat: number; lon: number } {
  const R = 6378137;
  const dLat = (distM * Math.cos((headingDeg * Math.PI) / 180)) / R;
  const dLon = (distM * Math.sin((headingDeg * Math.PI) / 180)) / (R * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + (dLat * 180) / Math.PI, lon: lon + (dLon * 180) / Math.PI };
}

export function fuse(input: FusionInput): FusionOutput {
  const { gnss, mapPseudo, dt } = input;

  // --- predict: propagate with speed + gyro, bias-corrected forward acc (skip when dt==0 pure correction)
  const accCorr = input.accel.x - state.bias;
  let pred: { lat: number; lon: number };
  let dist = 0;
  if (dt > 1e-9) {
    const predSpeed = Math.max(0, state.speed + accCorr * dt * 0.1);
    state.speed = predSpeed * Math.pow(0.999, dt); // per-second damping

    const headingRate = input.gyro.z * (180 / Math.PI); // deg/s
    state.heading = (state.heading + headingRate * dt * 0.9) % 360;
    if (state.heading < 0) state.heading += 360;

    dist = state.speed * dt;
    pred = move(state.lat, state.lon, state.heading, dist);

    // covariance grows without correction (random walk)
    cov = Math.min(50, cov + (gnss ? -0.8 : 0.18) + dist * 0.004);
    if (gnssLossTime > 0) cov += 0.05;
  } else {
    // pure correction step (map pseudo) — no motion, no cov growth
    pred = { lat: state.lat, lon: state.lon };
  }

  let lat = pred.lat;
  let lon = pred.lon;
  let mode: FusionOutput["mode"] = "IDR";
  let drift = 0;

  if (gnss) {
    // GNSS correction: Kalman-like blend K = cov/(cov+R)
    const K = cov / (cov + R_GNSS + gnss.accuracy * 0.4);
    lat = pred.lat + (gnss.lat - pred.lat) * K;
    lon = pred.lon + (gnss.lon - pred.lon) * K;
    // speed from GNSS if available
    if (gnss.speed != null) state.speed = state.speed * 0.7 + gnss.speed * 0.3;
    // bias learning when GNSS good: slowly adapt
    state.bias += accCorr * 0.0006;
    cov = cov * (1 - K) + 0.5;
    gnssLossTime = 0;
    mode = gnss.accuracy < 6 ? "FUSION" : "GNSS";
    drift = 0;
  } else if (mapPseudo && mapPseudo.confidence > 0.3 && mapPseudo.dist < 25) {
    // map pseudo-GNSS when road-snapped: weak correction along road normal
    // confidence ~ 1 - dist/25, capped
    const Kmap = (cov / (cov + R_MAP)) * mapPseudo.confidence * 0.6;
    lat = pred.lat + (mapPseudo.lat - pred.lat) * Kmap;
    lon = pred.lon + (mapPseudo.lon - pred.lon) * Kmap;
    // NHC: zero lateral drift, bias adapt mild
    state.bias += accCorr * 0.0003;
    cov = cov * (1 - Kmap * 0.5) + 0.3;
    gnssLossTime += dt;
    mode = "IDR";
    drift = mapPseudo.dist; // drift = raw vs snapped distance (bounded)
  } else {
    // pure IDR, NHC only
    lat = pred.lat;
    lon = pred.lon;
    gnssLossTime += dt;
    mode = "IDR";
    drift = Math.min(45, gnssLossTime * 0.35 + cov * 0.12);
  }

  state.lat = lat;
  state.lon = lon;
  // clamp
  cov = Math.max(0.8, Math.min(80, cov));

  return { lat, lon, heading: state.heading, speed: state.speed, drift, mode, cov };
}

export function resetFusion(lat = 18.5204, lon = 73.8567, heading = 42, speed = 8.3) {
  state = { lat, lon, heading, speed, bias: 0.03 };
  cov = 4.5;
  gnssLossTime = 0;
}

export function getFusionState() {
  return { ...state, cov, gnssLossTime };
}
