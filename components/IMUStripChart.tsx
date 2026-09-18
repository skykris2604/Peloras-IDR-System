import { View, Text, StyleSheet } from "react-native";
import { theme } from "@/utils/theme";

interface Props {
  title: string;
  unit: string;
  values: number[];
  color: string;
  avg: string;
}

export function IMUStripChart({ title, unit, values, color, avg }: Props) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, -1);
  const range = max - min || 1;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.avg}>{avg} {unit}</Text>
      </View>
      <View style={styles.chart}>
        {values.map((v, i) => {
          const h = ((v - min) / range) * 48 + 4;
          const isZero = Math.abs(v) < 0.05;
          return (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: h,
                  backgroundColor: isZero ? theme.border2 : color,
                  opacity: 0.3 + (i / values.length) * 0.7,
                },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.footer}>
        <Text style={styles.minMax}>{min.toFixed(1)}</Text>
        <Text style={styles.minMax}>{max.toFixed(1)} {unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.bgCard,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flex: 1,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 11, fontWeight: "800", color: theme.text, letterSpacing: 0.5 },
  avg: { fontSize: 11, fontWeight: "700", color: theme.textMuted },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    height: 56,
    marginTop: 10,
    backgroundColor: "#070D1C",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingBottom: 4,
  },
  bar: { flex: 1, borderRadius: 2, minWidth: 2 },
  footer: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  minMax: { fontSize: 10, color: theme.textDim },
});
