// FileSystem imported lazily to avoid RN esbuild pull in node tests

export interface IoRow {
  t: number; // s
  ax: number; ay: number; az: number;
  gx: number; gy: number; gz: number;
  lat: number; lon: number;
  speed?: number; // m/s
  accuracy?: number;
}

// minimal CSV parser: expects header row with names like timestamp,ax,ay,az,gx,gy,gz,lat,lon,speed
// fallback: if no header, assume column order t,ax,ay,az,gx,gy,gz,lat,lon
export function parseIoCsv(text: string): IoRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const hasHeader = header.some((h) => h.includes("ax") || h.includes("lat"));
  const start = hasHeader ? 1 : 0;
  const idx = (names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };
  const iAx = idx(["ax", "acc_x", "accx"]);
  const iAy = idx(["ay", "acc_y", "accy"]);
  const iAz = idx(["az", "acc_z", "accz"]);
  const iGx = idx(["gx", "gyro_x", "gyrox"]);
  const iGy = idx(["gy", "gyro_y", "gyroy"]);
  const iGz = idx(["gz", "gyro_z", "gyroz"]);
  const iLat = idx(["lat", "latitude"]);
  const iLon = idx(["lon", "longitude", "lng"]);
  const iT = idx(["t", "timestamp", "time"]);

  const rows: IoRow[] = [];
  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.length < 6) continue;
    const fallback = (pos: number) => parseFloat(cols[pos] ?? "0");
    rows.push({
      t: iT !== -1 ? parseFloat(cols[iT]) : i * 0.01,
      ax: iAx !== -1 ? parseFloat(cols[iAx]) : fallback(1),
      ay: iAy !== -1 ? parseFloat(cols[iAy]) : fallback(2),
      az: iAz !== -1 ? parseFloat(cols[iAz]) : fallback(3),
      gx: iGx !== -1 ? parseFloat(cols[iGx]) : fallback(4),
      gy: iGy !== -1 ? parseFloat(cols[iGy]) : fallback(5),
      gz: iGz !== -1 ? parseFloat(cols[iGz]) : fallback(6),
      lat: iLat !== -1 ? parseFloat(cols[iLat]) : fallback(7),
      lon: iLon !== -1 ? parseFloat(cols[iLon]) : fallback(8),
      speed: cols[9] ? parseFloat(cols[9]) : undefined,
      accuracy: cols[10] ? parseFloat(cols[10]) : undefined,
    });
  }
  return rows;
}

// synthetic IO-VNBD-like rows for demo when no CSV: straight road with noise + GNSS outage segment
export function synthIoRows(distanceM: number, outageStartM = 300, outageLenM = 1000, speedMs = 16.6): IoRow[] {
  const dt = 0.01; // 100Hz
  const totalT = distanceM / speedMs;
  const steps = Math.round(totalT / dt);
  const rows: IoRow[] = [];
  const startLat = 18.5204, startLon = 73.8567, bearing = 42;
  const R = 6378137;
  let lat = startLat, lon = startLon;
  for (let i = 0; i <= steps; i++) {
    const s = i * speedMs * dt;
    const inOutage = s >= outageStartM && s < outageStartM + outageLenM;
    // add IMU noise: cruising forward acc ~0, not 0.1
    const axNoise = (Math.random() - 0.5) * 0.35;
    const azNoise = (Math.random() - 0.5) * 0.6 + (Math.random() < 0.003 ? 7 : 0);
    const gzNoise = (Math.random() - 0.5) * 0.02;
    rows.push({
      t: i * dt,
      ax: axNoise,
      ay: (Math.random() - 0.5) * 0.2,
      az: 9.81 + azNoise,
      gx: (Math.random() - 0.5) * 0.01,
      gy: (Math.random() - 0.5) * 0.01,
      gz: gzNoise,
      lat: inOutage ? NaN : lat, // NaN signals GNSS drop
      lon: inOutage ? NaN : lon,
      speed: speedMs,
      accuracy: inOutage ? undefined : 3.5,
    });
    const d = speedMs * dt;
    const dLat = (d * Math.cos((bearing * Math.PI) / 180)) / R;
    const dLon = (d * Math.sin((bearing * Math.PI) / 180)) / (R * Math.cos((lat * Math.PI) / 180));
    lat += (dLat * 180) / Math.PI;
    lon += (dLon * 180) / Math.PI;
  }
  return rows;
}

export async function loadCsvFromFs(uri: string): Promise<string> {
  try {
    const FS: any = await import("expo-file-system");
    if (FS.readAsStringAsync) return FS.readAsStringAsync(uri);
    if (FS.File) {
      const f = new FS.File(uri);
      if (f.exists) return f.text();
    }
  } catch {}
  const res = await fetch(uri);
  return res.text();
}

// run playback through full pipeline (filter+fusion+matcher) offline, return trails + drift
export type PlaybackResult = {
  gtTrail: { latitude: number; longitude: number }[];
  predRawTrail: { latitude: number; longitude: number }[];
  predSnapTrail: { latitude: number; longitude: number }[];
  distance: number;
  drift: number;
  driftPct: number;
  pass: boolean;
};
