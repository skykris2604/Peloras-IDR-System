import { View, Text, StyleSheet } from "react-native";
import { theme } from "@/utils/theme";

export function DriftHUD({
  distance,
  drift,
  driftPct,
}: {
  distance: number;
  drift: number;
  driftPct: number;
}) {
  const pass = driftPct < 10;
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>DISTANCE</Text>
          <Text style={styles.val}>{(distance / 1000).toFixed(2)} km</Text>
        </View>
        <View style={styles.div} />
        <View style={styles.col}>
          <Text style={styles.label}>DRIFT</Text>
          <Text style={[styles.val, { color: pass ? theme.success : theme.danger }]}>{drift.toFixed(1)} m</Text>
        </View>
        <View style={styles.div} />
        <View style={styles.col}>
          <Text style={styles.label}>DRIFT %</Text>
          <Text style={[styles.val, { color: pass ? theme.success : theme.danger }]}>
            {driftPct.toFixed(1)}%
          </Text>
        </View>
      </View>
      <View style={[styles.badge, { backgroundColor: pass ? theme.success + "18" : theme.danger + "18", borderColor: pass ? theme.success : theme.danger }]}>
        <Text style={[styles.badgeText, { color: pass ? theme.success : theme.danger }]}>
          {pass ? "✓ <10% SPEC PASS" : "✗ >10% FAIL"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.bgCard,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  col: { alignItems: "center", flex: 1 },
  label: { fontSize: 10, color: theme.textDim, fontWeight: "700", letterSpacing: 0.8 },
  val: { fontSize: 16, color: theme.text, fontWeight: "800", marginTop: 2 },
  div: { width: 1, height: 28, backgroundColor: theme.border, marginHorizontal: 8 },
  badge: { borderWidth: 1, borderRadius: 999, paddingVertical: 5, alignItems: "center" },
  badgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
});
