import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, UrlTile } from "react-native-maps";
import { LatLng } from "@/store/navStore";
import { theme } from "@/utils/theme";
import { roadNetwork } from "@/engine/roadNetwork";

interface Props {
  position: LatLng;
  heading: number;
  rawTrail: LatLng[];
  snappedTrail: LatLng[];
  gnssStatus: string;
}

export function MapViewIDR({ position, heading, rawTrail, snappedTrail, gnssStatus }: Props) {
  const region = useMemo(
    () => ({
      latitude: position.latitude,
      longitude: position.longitude,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008,
    }),
    [position]
  );

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={region}
        showsUserLocation={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        customMapStyle={darkMapStyle}
      >
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
          tileSize={256}
        />

        {roadNetwork.map((seg) => (
          <Polyline
            key={seg.id}
            coordinates={seg.poly}
            strokeColor="#2A3F5E"
            strokeWidth={6}
            lineCap="round"
          />
        ))}
        {roadNetwork.map((seg) => (
          <Polyline
            key={seg.id + "-inner"}
            coordinates={seg.poly}
            strokeColor="#3A4F6A"
            strokeWidth={2}
            lineCap="round"
          />
        ))}

        {rawTrail.length > 1 && (
          <Polyline
            coordinates={rawTrail}
            strokeColor={theme.danger}
            strokeWidth={3}
            lineDashPattern={[6, 6]}
          />
        )}

        {snappedTrail.length > 1 && (
          <Polyline
            coordinates={snappedTrail}
            strokeColor={gnssStatus === "OUTAGE" ? theme.accent : theme.accent + "CC"}
            strokeWidth={gnssStatus === "OUTAGE" ? 5 : 4}
          />
        )}

        <Marker coordinate={position} anchor={{ x: 0.5, y: 0.5 }} rotation={heading} flat>
          <View style={styles.vehicle}>
            <View style={styles.vehicleInner}>
              <View style={styles.vehicleArrow} />
            </View>
          </View>
        </Marker>
      </MapView>
    </View>
  );
}

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#0F1A2E" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8A9AB5" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0B1220" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1E2F4A" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#243656" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0A1A33" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

const styles = StyleSheet.create({
  container: { flex: 1, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#1E2F4A" },
  map: { flex: 1 },
  vehicle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.accent,
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00E5FF",
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  vehicleInner: { width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  vehicleArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#0B1220",
    marginBottom: 2,
  },
});
