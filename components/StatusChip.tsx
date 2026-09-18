import { View, Text, StyleSheet } from "react-native";
import { theme } from "@/utils/theme";
import { GnssStatus, FusionMode } from "@/store/navStore";

export function StatusChip({
  gnssStatus,
  fusionMode,
}: {
  gnssStatus: GnssStatus;
  fusionMode: FusionMode;
}) {
  const isOutage = gnssStatus === "OUTAGE";
  const isIdr = fusionMode === "IDR";
  const color = isOutage ? theme.outage : isIdr ? theme.warning : theme.success;
  const label = isOutage ? "GNSS OUTAGE • IDR ACTIVE" : fusionMode === "FUSION" ? "GNSS+INS FUSION" : "GNSS FIX";
  return (
    <View style={[styles.chip, { borderColor: color, backgroundColor: color + "18" }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{label}</Text>
      <Text style={styles.sub}>{isOutage ? "10Hz INS" : "1Hz GNSS • 10Hz EKF"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
  sub: { fontSize: 10, color: theme.textDim, fontWeight: "600", marginLeft: 4 },
});
