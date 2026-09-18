import { View, Text, StyleSheet, Pressable, Switch, ScrollView, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/utils/theme";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { edgeBridge } from "@/engine/edgeBridge";
import { useNavStore } from "@/store/navStore";

export default function SettingsScreen() {
  const [offline, setOffline] = useState(true);
  const [fog, setFog] = useState(false);
  const [edgeUrl, setEdgeUrl] = useState("ws://192.168.1.50:8080/imu");
  const [edgeHz, setEdgeHz] = useState(0);
  const [edgeStatus, setEdgeStatus] = useState("disconnected");
  const { pitch, roll, yaw, calibConfidence } = useNavStore();

  useEffect(() => {
    edgeBridge.onStatus = setEdgeStatus as any;
    edgeBridge.onSample = () => {};
    const iid = setInterval(() => setEdgeHz(Math.round(edgeBridge.hz)), 500);
    return () => clearInterval(iid);
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    if (fog) {
      // mock 200Hz when no real WS
      if (edgeBridge.status !== "connected") {
        cleanup = edgeBridge.mock(true, () => {});
        setEdgeStatus("connected (mock)");
        edgeBridge.hz = 200;
      } else {
        edgeBridge.connect(edgeUrl);
      }
    } else {
      edgeBridge.disconnect();
      setEdgeStatus("disconnected");
    }
    return () => {
      cleanup?.();
      if (!fog) edgeBridge.disconnect();
    };
  }, [fog, edgeUrl]);

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.section}>Map & Offline</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Offline OSM Tiles</Text>
              <Text style={styles.sub}>PMTiles cached to FileSystem • Pune 80 MB</Text>
            </View>
            <Switch value={offline} onValueChange={setOffline} trackColor={{ true: theme.accent }} />
          </View>
          <Pressable style={styles.btnSecondary}>
            <Ionicons name="download-outline" size={16} color={theme.text} />
            <Text style={styles.btnSecondaryText}>Manage Offline Region</Text>
          </Pressable>
          <Text style={styles.hint}>Tiles served via UrlTile OSM. Offline: FileSystem cache + local PMTiles server replaces UrlTile template.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Engine • GNSS+INS Fusion</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Edge FOG 200 Hz Mode</Text>
              <Text style={styles.sub}>WebSocket external IMU • bypasses phone filter</Text>
            </View>
            <Switch value={fog} onValueChange={setFog} trackColor={{ true: theme.accent }} />
          </View>
          {fog && (
            <>
              <View style={styles.inputRow}>
                <Ionicons name="link-outline" size={14} color={theme.textDim} />
                <TextInput style={styles.input} value={edgeUrl} onChangeText={setEdgeUrl} placeholder="ws://host:port/imu" placeholderTextColor={theme.textDim} />
              </View>
              <View style={styles.kv}>
                <Text style={styles.k}>Edge status</Text>
                <Text style={[styles.v, { color: edgeStatus.includes("connected") ? theme.success : theme.warning }]}>{edgeStatus} • {edgeHz}Hz</Text>
              </View>
              <View style={styles.kv}>
                <Text style={styles.k}>Update rate</Text>
                <Text style={styles.v}>{fog ? "200 Hz edge → 10 Hz fused" : "10 Hz phone"}</Text>
              </View>
            </>
          )}
          {!fog && (
            <View style={styles.kv}>
              <Text style={styles.k}>Update rate</Text>
              <Text style={styles.v}>10 Hz phone (100Hz IMU → 10Hz EKF)</Text>
            </View>
          )}
          <View style={styles.kv}>
            <Text style={styles.k}>Model</Text>
            <Text style={styles.v}>TFLite quantized 4.2 MB • 5ms</Text>
          </View>
          <View style={styles.kv}>
            <Text style={styles.k}>Map-match</Text>
            <Text style={styles.v}>HMM + NHC • σ12m • EKF pseudo</Text>
          </View>
          <View style={styles.kv}>
            <Text style={styles.k}>Calib</Text>
            <Text style={styles.v}>P{pitch.toFixed(1)} R{roll.toFixed(1)} Y{yaw.toFixed(1)} • {Math.round(calibConfidence * 100)}%</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Spec</Text>
          <Text style={styles.spec}>Drift &lt;10% • 5m/50m • 100m/1km @60kph • validated via playbackRunner + driftValidator. Live drift = haversine(raw,snapped) EMA.</Text>
          <Text style={styles.spec2}>EKF-lite: predict speed*dt, K= cov/(cov+R) GNSS 3m, map 6m, cov grow 0.18/s outage, blend heading 0.3 to road.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>About</Text>
          <Text style={styles.about}>Peloras IDR • SIH 2025 • GNSS+INS Fusion • Expo SDK 57 • react-native-maps OSM UrlTile. Offline-first, edge-deployable software engine (phone + external FOG).</Text>
          <Text style={styles.ver}>v0.4.0-p4 • EKF+HMM+ZUPT • IO-VNBD playback • edge 200Hz</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  scroll: { padding: 16, gap: 12 },
  card: { backgroundColor: theme.bgCard, borderColor: theme.border, borderWidth: 1, borderRadius: 14, padding: 14, gap: 12 },
  section: { fontSize: 12, fontWeight: "800", color: theme.text, letterSpacing: 0.6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  label: { fontSize: 13, fontWeight: "700", color: theme.text },
  sub: { fontSize: 11, color: theme.textDim, marginTop: 2 },
  hint: { fontSize: 10, color: theme.textDim, lineHeight: 13 },
  spec: { fontSize: 11, color: theme.textMuted, lineHeight: 14 },
  spec2: { fontSize: 10, color: theme.textDim, lineHeight: 13 },
  btnSecondary: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: theme.bgCard2, borderWidth: 1, borderColor: theme.border, paddingVertical: 10, borderRadius: 10 },
  btnSecondaryText: { fontSize: 12, fontWeight: "700", color: theme.text },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#070D1C", borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  input: { flex: 1, color: theme.text, fontSize: 12, padding: 0 },
  kv: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#162544" },
  k: { fontSize: 12, color: theme.textMuted },
  v: { fontSize: 12, fontWeight: "700", color: theme.text },
  about: { fontSize: 12, color: theme.textMuted, lineHeight: 16 },
  ver: { fontSize: 10, color: theme.textDim },
});
