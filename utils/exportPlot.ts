import * as FileSystem from "expo-file-system";
import { captureRef } from "react-native-view-shot";

export async function exportViewToPng(viewRef: any, filename = "peloras_plot.png"): Promise<string> {
  const uri = await captureRef(viewRef, { format: "png", quality: 1, result: "tmpfile" });
  const dir = (FileSystem as any).documentDirectory ?? (FileSystem as any).cacheDirectory;
  if (!dir) return uri;
  const dest = `${dir}${filename}`;
  try {
    await (FileSystem as any).copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

export function trailsToCsv(
  gt: { latitude: number; longitude: number }[],
  raw: { latitude: number; longitude: number }[],
  snapped: { latitude: number; longitude: number }[]
): string {
  const header = "idx,gt_lat,gt_lon,raw_lat,raw_lon,snap_lat,snap_lon\n";
  const rows = gt.map((g, i) => {
    const r = raw[i] ?? g;
    const s = snapped[i] ?? r;
    return `${i},${g.latitude},${g.longitude},${r.latitude},${r.longitude},${s.latitude},${s.longitude}`;
  });
  return header + rows.join("\n");
}

export async function saveCsv(csv: string, filename = "peloras_trails.csv"): Promise<string> {
  const dir = (FileSystem as any).documentDirectory ?? (FileSystem as any).cacheDirectory;
  if (!dir) throw new Error("No FS dir");
  const path = `${dir}${filename}`;
  await (FileSystem as any).writeAsStringAsync(path, csv);
  return path;
}
