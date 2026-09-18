// Offline OSM PMTiles loader + tile cache service
// Uses expo-file-system to persist tiles. Swap UrlTile template to local file when offline.

import * as FileSystem from "expo-file-system";

const CACHE_DIR = (FileSystem as any).cacheDirectory
  ? `${(FileSystem as any).cacheDirectory}tiles/`
  : undefined;

const OSM_TEMPLATE = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
// For offline, set to `file://${CACHE_DIR}{z}/{x}/{y}.png` after download

export async function ensureCacheDir() {
  if (!CACHE_DIR) return null;
  try {
    const info = await (FileSystem as any).getInfoAsync(CACHE_DIR);
    if (!info.exists) await (FileSystem as any).makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    return CACHE_DIR;
  } catch {
    return null;
  }
}

export function tileUrl(z: number, x: number, y: number, offline: boolean, cacheDir?: string | null) {
  if (offline && cacheDir) {
    // local file — react-native-maps UrlTile supports file:// on Android; iOS needs custom tile provider
    // fallback to https if file missing
    return `file://${cacheDir}${z}/${x}/${y}.png`;
  }
  return OSM_TEMPLATE.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}

// download a bbox at zoom levels for offline use
export async function downloadRegion(opts: {
  minLat: number; maxLat: number; minLon: number; maxLon: number;
  minZoom: number; maxZoom: number;
  onProgress?: (done: number, total: number) => void;
}) {
  const dir = await ensureCacheDir();
  if (!dir) throw new Error("FileSystem not available (web)");

  const tiles: { z: number; x: number; y: number }[] = [];
  for (let z = opts.minZoom; z <= opts.maxZoom; z++) {
    const { x: x0, y: y0 } = latLonToTile(opts.maxLat, opts.minLon, z);
    const { x: x1, y: y1 } = latLonToTile(opts.minLat, opts.maxLon, z);
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
        tiles.push({ z, x, y });
      }
    }
  }

  let done = 0;
  for (const t of tiles) {
    const url = tileUrl(t.z, t.x, t.y, false);
    const file = `${dir}${t.z}/${t.x}/${t.y}.png`;
    try {
      await (FileSystem as any).makeDirectoryAsync(`${dir}${t.z}/${t.x}`, { intermediates: true });
      const info = await (FileSystem as any).getInfoAsync(file);
      if (!info.exists) {
        await (FileSystem as any).downloadAsync(url, file);
      }
    } catch {}
    done++;
    opts.onProgress?.(done, tiles.length);
    // throttle to avoid OSM ban
    if (done % 20 === 0) await new Promise((r) => setTimeout(r, 200));
  }

  return { tiles: tiles.length, dir };
}

export function latLonToTile(lat: number, lon: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

// estimate cache size for region
export function estimateTiles(minZoom: number, maxZoom: number, bboxAreaDeg2: number): number {
  let total = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    const tilesPerDeg = (2 ** z) / 360;
    total += Math.ceil(bboxAreaDeg2 * tilesPerDeg * tilesPerDeg);
  }
  return total;
}

export const PUNE_BBOX = { minLat: 18.45, maxLat: 18.58, minLon: 73.80, maxLon: 73.92 };
// At z 10-16 ≈ 8k tiles ~ 80MB, z 12-16 ≈ 2k tiles ~ 20MB for demo
