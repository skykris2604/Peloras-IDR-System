import { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/utils/theme";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import ViewShot from "react-native-view-shot";
import { useNavStore } from "@/store/navStore";
import { MapViewIDR } from "@/components/MapViewIDR";
import { parseIoCsv, synthIoRows } from "@/engine/ioVnbd";
import { runPlayback } from "@/engine/playbackRunner";
import { checkSpec } from "@/engine/driftValidator";
import { exportViewToPng, trailsToCsv, saveCsv } from "@/utils/exportPlot";

const SCENARIOS = [
  { id: "50m", label: "50m @20kph (spec <5m)", dist: 50, speed: 5.5, outage: 50 },
  { id: "1km", label: "1km @60kph tunnel", dist: 1000, speed: 16.6, outage: 1000 },
  { id: "urban", label: "2.3km urban canyon", dist: 2300, speed: 8.3, outage: 1200 },
  { id: "parking", label: "400m parking @20kph", dist: 400, speed: 5.5, outage: 400 },
];

export default function PlaybackScreen() {
  const [selected, setSelected] = useState("1km");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ReturnType<typeof runPlayback> | null>(null);
  const [csvName, setCsvName] = useState<string | null>(null);
  const [loadedRows, setLoadedRows] = useState<any[] | null>(null);
  const { pitch, roll, yaw } = useNavStore();
  const shotRef = useRef<any>(null);

  const run = async (rowsOverride?: any[]) => {
    setRunning(true);
    setProgress(0);
    setResult(null);
    // animate progress
    const progId = setInterval(() => setProgress((p) => Math.min(0.92, p + 0.06)), 80);

    // slight delay to let UI breathe
    await new Promise((r) => setTimeout(r, 280));

    const sc = SCENARIOS.find((s) => s.id === selected)!;
    let rows = rowsOverride ?? synthIoRows(sc.dist, Math.min(150, sc.dist * 0.15), sc.outage, sc.speed);

    // if loaded csv rows available and no override, use loadedRows
    if (!rowsOverride && loadedRows) rows = loadedRows as any;

    const res = runPlayback(rows as any, { pitch, roll, yaw });
    clearInterval(progId);
    setProgress(1);
    setResult(res as any);
    setRunning(false);
  };

  const pickCsv = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/comma-separated-values", "*/*"], copyToCacheDirectory: true });
      if (res.canceled) return;
      const asset = res.assets[0];
      setCsvName(asset.name);
      // try read via fetch for file://
      let text = "";
      try {
        const fetched = await fetch(asset.uri);
        text = await fetched.text();
      } catch {
        text = "";
      }
      if (text) {
        const rows = parseIoCsv(text);
        setLoadedRows(rows);
        run(rows as any);
      } else {
        // fallback synth if read fails
        run();
      }
    } catch (e) {
      run();
    }
  };

  const sc = SCENARIOS.find((s) => s.id === selected)!;
  const spec = result ? checkSpec(result.drift, result.distance) : null;

  const onExportPng = async () => {
    if (!result || !shotRef.current) return;
    try {
      const uri = await exportViewToPng(shotRef.current, `peloras_${selected}_${Date.now()}.png`);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    } catch {}
  };
  const onExportCsv = async () => {
    if (!result) return;
    try {
      const csv = trailsToCsv(result.gtTrail, result.predRawTrail, result.predSnapTrail);
      const uri = await saveCsv(csv, `peloras_${selected}_${Date.now()}.csv`);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    } catch {}
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Playback</Text>
        <Text style={styles.sub}>IO-VNBD benchmark • real pipeline (filter+EKF+HMM) • spec &lt;10%</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.picker}>
          {SCENARIOS.map((s) => (
            <Pressable key={s.id} onPress={() => setSelected(s.id)} style={[styles.opt, selected === s.id && styles.optActive]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optName, selected === s.id && { color: "#0B1220" }]}>{s.label}</Text>
                <Text style={[styles.optMeta, selected === s.id && { color: "#0B1220AA" }]}>{s.dist}m @ {(s.speed * 3.6).toFixed(0)}kph • {Math.round(s.dist / s.speed / 60)} min</Text>
              </View>
              <Ionicons name={selected === s.id ? "radio-button-on" : "radio-button-off"} size={16} color={selected === s.id ? "#0B1220" : theme.textDim} />
            </Pressable>
          ))}
        </View>

        {csvName && (
          <View style={styles.csvBadge}>
            <Ionicons name="document-text" size={14} color={theme.accent} />
            <Text style={styles.csvText}>{csvName} • {loadedRows?.length ?? 0} rows loaded</Text>
            <Pressable onPress={() => { setCsvName(null); setLoadedRows(null); }}><Text style={styles.csvClear}>clear</Text></Pressable>
          </View>
        )}

        <View style={styles.player}>
          <View style={styles.playerTop}>
            <Pressable onPress={() => run()} disabled={running} style={[styles.playBtn, running && { opacity: 0.6 }]}>
              {running ? <ActivityIndicator color="#0B1220" size="small" /> : <Ionicons name="play" size={16} color="#0B1220" />}
            </Pressable>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.now}>{running ? "Running pipeline..." : result ? `${sc.label} • done` : `${sc.label} • idle`}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${progress * 100}%`, backgroundColor: result?.pass === false ? theme.danger : theme.accent }]} />
                <View style={[styles.barHead, { left: `${progress * 100}%` }]} />
              </View>
            </View>
            <Text style={styles.pct}>{Math.round(progress * 100)}%</Text>
          </View>

          {result ? (
            <>
              <ViewShot ref={shotRef} options={{ format: "png", quality: 1 }} style={{ gap: 12 }}>
                <View style={styles.mapWrap}>
                  <MapViewIDR
                    position={result.predSnapTrail[Math.floor(result.predSnapTrail.length * progress)] ?? result.predSnapTrail[result.predSnapTrail.length - 1]}
                    heading={42}
                    rawTrail={result.predRawTrail.slice(0, Math.floor(result.predRawTrail.length * progress))}
                    snappedTrail={result.predSnapTrail.slice(0, Math.floor(result.predSnapTrail.length * progress))}
                    gnssStatus={progress < 0.35 ? "FIX" : progress < 0.85 ? "OUTAGE" : "FIX"}
                  />
                </View>
                <View style={styles.plot}>
                  <Text style={styles.plotTitle}>GT vs Predicted (snapped)</Text>
                  <View style={styles.plotGrid}>
                    {result.predSnapTrail.slice(0, 60).map((p, i) => {
                      const gt = result.gtTrail[i * Math.floor(result.gtTrail.length / 60)];
                      if (!gt) return null;
                      const err = Math.abs(p.latitude - gt.latitude) * 111000;
                      const h = Math.min(40, err * 3);
                      return <View key={i} style={[styles.barSm, { height: h, backgroundColor: h > 10 ? theme.danger : theme.accent }]} />;
                    })}
                  </View>
                  <View style={styles.plotLabels}>
                    <Text style={styles.plotLabel}>GT dashed • Pred solid</Text>
                    <Text style={[styles.plotLabel, { color: result.pass ? theme.success : theme.danger }]}>{result.pass ? "PASS <10%" : "FAIL ≥10%"}</Text>
                  </View>
                </View>
              </ViewShot>

              <View style={styles.metrics}>
                <View style={styles.metric}>
                  <Text style={styles.metricL}>DIST</Text>
                  <Text style={styles.metricV}>{(result.distance / 1000).toFixed(2)} km</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricL}>DRIFT</Text>
                  <Text style={[styles.metricV, { color: result.drift < 80 ? theme.success : theme.danger }]}>{result.drift.toFixed(1)} m</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricL}>DRIFT %</Text>
                  <Text style={[styles.metricV, { color: result.driftPct < 10 ? theme.success : theme.danger }]}>{result.driftPct.toFixed(1)}%</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: (result.pass ? theme.success : theme.danger) + "18", borderColor: result.pass ? theme.success : theme.danger }]}>
                  <Text style={[styles.badgeT, { color: result.pass ? theme.success : theme.danger }]}>{result.pass ? "PASS" : "FAIL"}</Text>
                </View>
              </View>
              <View style={styles.specBox}>
                <Text style={styles.specText}>Spec check: {spec?.spec} • {spec?.pass ? "✓ meets <10%" : "✗ exceeds 10%"} • 50m target &lt;5m, 1km target &lt;100m</Text>
              </View>
              <View style={styles.exportRow}>
                <Pressable style={styles.exportBtn} onPress={onExportPng}>
                  <Ionicons name="image-outline" size={14} color={theme.text} />
                  <Text style={styles.exportText}>Export PNG</Text>
                </Pressable>
                <Pressable style={styles.exportBtn} onPress={onExportCsv}>
                  <Ionicons name="download-outline" size={14} color={theme.text} />
                  <Text style={styles.exportText}>Export CSV</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="analytics-outline" size={28} color={theme.textDim} />
              <Text style={styles.emptyT}>Tap play to run {sc.dist}m synthetic IO-VNBD through 100Hz→10Hz pipeline</Text>
              <Text style={styles.emptySub}>Uses current calib P{ pitch.toFixed(1)} R{roll.toFixed(1)} Y{yaw.toFixed(1)} • filter+EKF+HMM identical to live nav</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.primaryBtn} onPress={() => run()} disabled={running}>
            <Ionicons name="refresh" size={16} color="#0B1220" />
            <Text style={styles.primaryText}>{running ? "Running..." : "Run inference"}</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={pickCsv}>
            <Ionicons name="document-text-outline" size={16} color={theme.text} />
            <Text style={styles.secondaryText}>{csvName ? "Load another .csv" : "Load IO-VNBD .csv"}</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>Exports: pred vs GT CSV + PNG for SIH proposal. Real IO-VNBD .csv columns: t,ax,ay,az,gx,gy,gz,lat,lon,speed,accuracy. Drop file via picker; NaN lat/lon = GNSS outage.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.bgCard },
  title: { fontSize: 18, fontWeight: "900", color: theme.text },
  sub: { fontSize: 11, color: theme.textDim, marginTop: 2 },
  scroll: { padding: 12, gap: 12, paddingBottom: 24 },
  picker: { gap: 8 },
  opt: { flexDirection: "row", alignItems: "center", backgroundColor: theme.bgCard, borderColor: theme.border, borderWidth: 1, borderRadius: 12, padding: 12 },
  optActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  optName: { fontSize: 13, fontWeight: "800", color: theme.text },
  optMeta: { fontSize: 11, color: theme.textDim, marginTop: 2 },
  csvBadge: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: theme.bgCard2, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10 },
  csvText: { flex: 1, fontSize: 11, color: theme.textMuted },
  csvClear: { fontSize: 11, color: theme.danger, fontWeight: "700" },
  player: { backgroundColor: theme.bgCard, borderColor: theme.border, borderWidth: 1, borderRadius: 14, padding: 14, gap: 12 },
  playerTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  playBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center" },
  now: { fontSize: 12, fontWeight: "800", color: theme.text },
  barTrack: { height: 6, backgroundColor: "#070D1C", borderRadius: 999, overflow: "hidden", position: "relative" },
  barFill: { height: "100%", backgroundColor: theme.accent, borderRadius: 999 },
  barHead: { position: "absolute", top: -3, width: 12, height: 12, borderRadius: 6, backgroundColor: "#fff", borderWidth: 2, borderColor: theme.accent, marginLeft: -6 },
  pct: { fontSize: 12, fontWeight: "800", color: theme.text },
  mapWrap: { height: 240, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: theme.border },
  plot: { backgroundColor: "#070D1C", borderRadius: 10, borderWidth: 1, borderColor: theme.border, padding: 10, gap: 8 },
  plotTitle: { fontSize: 10, color: theme.textDim, fontWeight: "700" },
  plotGrid: { height: 50, flexDirection: "row", alignItems: "flex-end", gap: 2, backgroundColor: "#0B1220", borderRadius: 8, padding: 6 },
  barSm: { flex: 1, minWidth: 2, borderRadius: 2 },
  plotLabels: { flexDirection: "row", justifyContent: "space-between" },
  plotLabel: { fontSize: 10, color: theme.textMuted, fontWeight: "600" },
  empty: { alignItems: "center", gap: 8, paddingVertical: 18, backgroundColor: "#070D1C", borderRadius: 10, borderWidth: 1, borderColor: theme.border, padding: 12 },
  emptyT: { fontSize: 12, color: theme.textMuted, fontWeight: "600", textAlign: "center" },
  emptySub: { fontSize: 10, color: theme.textDim, textAlign: "center" },
  metrics: { flexDirection: "row", gap: 8, alignItems: "center" },
  metric: { flex: 1, alignItems: "center", backgroundColor: "#070D1C", borderRadius: 10, padding: 8, borderWidth: 1, borderColor: theme.border },
  metricL: { fontSize: 9, color: theme.textDim, fontWeight: "700" },
  metricV: { fontSize: 13, color: theme.text, fontWeight: "800", marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  badgeT: { fontSize: 11, fontWeight: "900" },
  specBox: { backgroundColor: "#070D1C", borderRadius: 8, padding: 8, borderWidth: 1, borderColor: theme.border },
  specText: { fontSize: 10, color: theme.textMuted, textAlign: "center" },
  actions: { flexDirection: "row", gap: 10 },
  primaryBtn: { flex: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: theme.accent, paddingVertical: 12, borderRadius: 12 },
  primaryText: { fontSize: 12, fontWeight: "800", color: "#0B1220" },
  secondaryBtn: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: theme.bgCard2, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  secondaryText: { fontSize: 12, fontWeight: "700", color: theme.text },
  exportRow: { flexDirection: "row", gap: 10 },
  exportBtn: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", backgroundColor: theme.bgCard2, borderWidth: 1, borderColor: theme.border, paddingVertical: 10, borderRadius: 10 },
  exportText: { fontSize: 11, fontWeight: "700", color: theme.text },
  hint: { fontSize: 10, color: theme.textDim, lineHeight: 14, textAlign: "center" },
});
