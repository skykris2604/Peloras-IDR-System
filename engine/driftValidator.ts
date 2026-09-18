import { LatLng } from "@/store/navStore";
import { haversine } from "./roadNetwork";

export interface DriftSample {
  pred: LatLng;
  gt: LatLng;
  distTravelled: number; // cumulative gt distance
  error: number; // meters
}

export function computeDriftSeries(predTrail: LatLng[], gtTrail: LatLng[]): DriftSample[] {
  if (predTrail.length !== gtTrail.length) throw new Error("trail len mismatch");
  const out: DriftSample[] = [];
  let cum = 0;
  for (let i = 0; i < predTrail.length; i++) {
    if (i > 0) cum += haversine(gtTrail[i - 1], gtTrail[i]);
    out.push({
      pred: predTrail[i],
      gt: gtTrail[i],
      distTravelled: cum,
      error: haversine(predTrail[i], gtTrail[i]),
    });
  }
  return out;
}

export function driftPct(error: number, distance: number): number {
  if (distance < 1e-6) return 0;
  return (error / distance) * 100;
}

export function checkSpec(error: number, distance: number): { pass: boolean; pct: number; spec: string } {
  const pct = driftPct(error, distance);
  const pass = pct < 10;
  const spec = distance <= 60 ? `5m @50m (${pct.toFixed(1)}%)` : `100m @1km (${pct.toFixed(1)}%)`;
  return { pass, pct, spec };
}

// synthetic ground truth generator for 1km straight + tunnel segment vs mock road
export function synthGroundTruth(distanceM: number, bearingDeg = 42, start = { latitude: 18.5204, longitude: 73.8567 }): LatLng[] {
  const pts: LatLng[] = [];
  const steps = Math.max(10, Math.round(distanceM / 2)); // 2m step
  let lat = start.latitude, lon = start.longitude;
  const R = 6378137;
  const d = distanceM / steps;
  for (let i = 0; i <= steps; i++) {
    pts.push({ latitude: lat, longitude: lon });
    const dLat = (d * Math.cos((bearingDeg * Math.PI) / 180)) / R;
    const dLon = (d * Math.sin((bearingDeg * Math.PI) / 180)) / (R * Math.cos((lat * Math.PI) / 180));
    lat += (dLat * 180) / Math.PI;
    lon += (dLon * 180) / Math.PI;
  }
  return pts;
}

// quick validator for current navStore trails (approx: snapped vs raw as proxy gt when no gt)
export function validateCurrent(rawTrail: LatLng[], snappedTrail: LatLng[]): { error: number; dist: number; pct: number; pass: boolean } {
  if (rawTrail.length === 0 || snappedTrail.length === 0) return { error: 0, dist: 0, pct: 0, pass: true };
  const lastRaw = rawTrail[rawTrail.length - 1];
  const lastSnap = snappedTrail[snappedTrail.length - 1];
  const error = haversine(lastRaw, lastSnap);
  let dist = 0;
  for (let i = 1; i < snappedTrail.length; i++) dist += haversine(snappedTrail[i - 1], snappedTrail[i]);
  // if dist small, use straight distance approx 1km mock
  if (dist < 10) dist = haversine(snappedTrail[0], lastSnap);
  const pct = driftPct(error, Math.max(dist, 1));
  return { error, dist, pct, pass: pct < 10 };
}
