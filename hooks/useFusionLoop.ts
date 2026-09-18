import { useEffect, useRef } from "react";
import { useNavStore } from "@/store/navStore";
import { fuse } from "@/engine/fusion";
import { useGNSS } from "./useGNSS";
import { useIMUStream } from "./useIMUStream";
import { matchPosition } from "@/engine/mapMatcher";
import { haversine } from "@/engine/roadNetwork";

export function useFusionLoop(enabled: boolean) {
  const { pos: gnssPos } = useGNSS(enabled);
  const { output } = useIMUStream(enabled, 10);
  const lastAtRef = useRef(Date.now());
  const fusedRef = useRef({ lat: 18.5204, lon: 73.8567, heading: 42 });

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastAtRef.current) / 1000;
      lastAtRef.current = now;
      const store = useNavStore.getState();

      // GNSS gating: OUTAGE sim overrides real fix
      const isOutage = store.isOutageSim;
      const gnss = !isOutage && gnssPos
        ? {
            lat: gnssPos.coords.latitude,
            lon: gnssPos.coords.longitude,
            accuracy: gnssPos.coords.accuracy ?? 5,
            speed: gnssPos.coords.speed ?? undefined,
          }
        : undefined;

      // --- step 1: EKF predict + GNSS correct (if available)
      const res = fuse({
        accel: { x: output.forwardAcc, y: 0, z: 9.81 },
        gyro: { x: 0, y: 0, z: output.gyroYaw },
        gnss,
        dt,
      });

      let heading = res.heading;
      if (!gnss) heading = (heading + output.gyroYaw * dt * (180 / Math.PI) * 0.9) % 360;
      if (heading < 0) heading += 360;

      const speed = output.speed > 0 ? output.speed : res.speed;
      fusedRef.current = { lat: res.lat, lon: res.lon, heading };

      store.setSpeed(speed);
      store.setGnssStatus(gnss ? "FIX" : "OUTAGE");
      store.setFusionMode(res.mode);

      // raw point with INS noise (blow up when GNSS denied / pothole)
      const raw = {
        latitude: res.lat + (output.isPothole ? 0.00002 : 0) + (Math.random() - 0.5) * (gnss ? 0 : 0.000035),
        longitude: res.lon + (Math.random() - 0.5) * (gnss ? 0 : 0.000035),
      };

      // --- step 2: HMM map-match with NHC
      const matched = matchPosition(raw, heading, speed, !!gnss);
      let snapped = matched.snapped;
      let displayPos = matched.isSnapped ? snapped : raw;
      let displayHeading = heading;

      if (matched.isSnapped && matched.candidate && matched.candidate.bearingDiff < 20) {
        const roadBrg = matched.candidate.bearing;
        let diff = ((roadBrg - heading + 540) % 360) - 180;
        displayHeading = (heading + diff * 0.3 + 360) % 360;
      }

      // --- step 3: EKF map-pseudo correction when GNSS denied but snapped (reduces lateral drift)
      if (!gnss && matched.isSnapped) {
        const conf = Math.max(0, 1 - matched.rawDist / 25);
        const corr = fuse({
          accel: { x: 0, y: 0, z: 0 },
          gyro: { x: 0, y: 0, z: 0 },
          mapPseudo: { lat: matched.snapped.latitude, lon: matched.snapped.longitude, dist: matched.rawDist, confidence: conf },
          dt: 0,
        });
        // blend display toward EKF-corrected (which is Kmap blended)
        displayPos = { latitude: corr.lat, longitude: corr.lon };
        snapped = displayPos; // trail snapped follows EKF not pure projection, tighter
      }

      store.setPosition(displayPos);
      store.setHeading(displayHeading);
      store.setSnap(matched.candidate?.name ?? null, matched.rawDist, matched.isSnapped);

      store.appendTrail(raw, snapped);

      // distance & drift: dist += speed*dt, drift = haversine(raw,snapped) bounded by map, else GNSS decay
      if (!gnss) {
        const prev = useNavStore.getState().distanceTravelled;
        const nextDist = prev + speed * dt;
        const err = haversine(raw, snapped); // proxy ground truth when no GT (snapped close to truth)
        // smooth drift with EMA to avoid jitter
        const prevDrift = useNavStore.getState().drift;
        const drift = prevDrift * 0.85 + err * 0.15;
        const pct = nextDist > 0 ? (drift / nextDist) * 100 : 0;
        useNavStore.setState({ distanceTravelled: nextDist, drift, driftPct: pct });
      } else {
        const s = useNavStore.getState();
        // GNSS fix: snap drift toward 0 with decay, but keep distance
        const nextDist = s.distanceTravelled + speed * dt;
        const drift = s.drift * 0.92;
        const pct = nextDist > 0 ? (drift / nextDist) * 100 : 0;
        useNavStore.setState({ distanceTravelled: nextDist, drift, driftPct: pct, accuracy: gnss.accuracy });
      }
    }, 100); // 10Hz

    return () => clearInterval(id);
  }, [enabled, gnssPos, output.forwardAcc, output.gyroYaw, output.isPothole, output.speed]);

  return { fused: fusedRef.current, imu: output, gnssPos };
}
