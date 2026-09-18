import { useEffect, useState } from "react";
import * as Location from "expo-location";
import { Platform } from "react-native";

export function useGNSS(enabled: boolean) {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [pos, setPos] = useState<Location.LocationObject | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (Platform.OS === "web") {
      // web: use browser geolocation if available, else null (playback will mock)
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (p) => {
            setGranted(true);
            setPos({
              coords: {
                latitude: p.coords.latitude,
                longitude: p.coords.longitude,
                altitude: p.coords.altitude,
                accuracy: p.coords.accuracy,
                altitudeAccuracy: null,
                heading: p.coords.heading,
                speed: p.coords.speed,
              },
              timestamp: p.timestamp,
            } as any);
          },
          () => setGranted(false)
        );
      }
      return;
    }

    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setGranted(status === "granted");
      if (status !== "granted") {
        setError("Location permission denied");
        return;
      }
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
        (loc) => setPos(loc)
      );
    })().catch((e) => setError(String(e)));

    return () => sub?.remove();
  }, [enabled]);

  return { granted, pos, error };
}
