import { View, Text, Pressable, StyleSheet } from "react-native";
import { theme } from "@/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useNavStore } from "@/store/navStore";

export function BlackoutInjector() {
  const { isOutageSim, startOutageSim, stopOutageSim, gnssStatus } = useNavStore();
  const isOutage = isOutageSim;

  const onPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isOutage) stopOutageSim();
    else startOutageSim();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>GNSS Deficit Handler</Text>
          <Text style={styles.sub}>
            {isOutage ? "Simulating tunnel • 10Hz IDR active" : "Tap to inject GNSS blackout"}
          </Text>
        </View>
        <Pressable
          onPress={onPress}
          style={[styles.btn, { backgroundColor: isOutage ? theme.success : theme.outage }]}
        >
          <Ionicons name={isOutage ? "radio" : "cloud-offline"} size={16} color="#fff" />
          <Text style={styles.btnText}>{isOutage ? "RESTORE GNSS" : "INJECT OUTAGE"}</Text>
        </Pressable>
      </View>
      <View style={styles.presets}>
        {[
          { label: "50m", dist: 50 },
          { label: "500m", dist: 500 },
          { label: "1km @60kph", dist: 1000 },
        ].map((p) => (
          <Pressable
            key={p.label}
            onPress={async () => {
              await Haptics.selectionAsync();
              startOutageSim();
            }}
            style={styles.presetBtn}
          >
            <Text style={styles.presetText}>{p.label}</Text>
          </Pressable>
        ))}
        <Text style={styles.presetHint}>spec: &lt;5m/50m • &lt;100m/1km</Text>
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
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 13, fontWeight: "800", color: theme.text },
  sub: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  btnText: { fontSize: 12, fontWeight: "800", color: "#fff" },
  presets: { flexDirection: "row", gap: 8, alignItems: "center" },
  presetBtn: {
    backgroundColor: theme.bgCard2,
    borderColor: theme.border,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  presetText: { fontSize: 11, fontWeight: "700", color: theme.accent },
  presetHint: { fontSize: 10, color: theme.textDim, marginLeft: 6 },
});
