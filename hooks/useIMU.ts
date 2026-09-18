import { useEffect, useState, useRef } from "react";
import { Accelerometer, Gyroscope, Magnetometer } from "expo-sensors";
import { Platform } from "react-native";

export interface IMUSample {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export function useIMU(enabled: boolean, intervalMs = 20) {
  const [accel, setAccel] = useState<IMUSample>({ x: 0, y: 0, z: 9.81, timestamp: 0 });
  const [gyro, setGyro] = useState<IMUSample>({ x: 0, y: 0, z: 0, timestamp: 0 });
  const [mag, setMag] = useState<IMUSample>({ x: 0, y: 0, z: 0, timestamp: 0 });
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let accelSub: any, gyroSub: any, magSub: any;

    (async () => {
      const aAvail = await Accelerometer.isAvailableAsync().catch(() => false);
      const gAvail = await Gyroscope.isAvailableAsync().catch(() => false);
      setAvailable(!!aAvail || !!gAvail);

      if (Platform.OS === "web") {
        // web: sensors not available, keep mock
        return;
      }

      Accelerometer.setUpdateInterval(intervalMs);
      Gyroscope.setUpdateInterval(intervalMs);
      Magnetometer.setUpdateInterval(100);

      accelSub = Accelerometer.addListener((d) => setAccel({ ...d, timestamp: Date.now() }));
      gyroSub = Gyroscope.addListener((d) => setGyro({ ...d, timestamp: Date.now() }));
      magSub = Magnetometer.addListener((d) => setMag({ ...d, timestamp: Date.now() }));
    })();

    return () => {
      accelSub?.remove();
      gyroSub?.remove();
      magSub?.remove();
    };
  }, [enabled, intervalMs]);

  return { accel, gyro, mag, available };
}

// mock generator for web / no-sensor demo
export function useMockIMU(enabled: boolean) {
  const [accel, setAccel] = useState<IMUSample>({ x: 0.12, y: -0.08, z: 9.81, timestamp: 0 });
  const [gyro, setGyro] = useState<IMUSample>({ x: 0.01, y: -0.02, z: 0.005, timestamp: 0 });

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      const t = Date.now() / 1000;
      setAccel({
        x: Math.sin(t * 3) * 0.4 + (Math.random() - 0.5) * 0.3,
        y: Math.cos(t * 2.2) * 0.3 + (Math.random() - 0.5) * 0.2,
        z: 9.81 + Math.sin(t * 8) * 0.15 + (Math.random() - 0.5) * 0.2,
        timestamp: Date.now(),
      });
      setGyro({
        x: Math.sin(t * 1.5) * 0.02,
        y: Math.cos(t * 1.2) * 0.02,
        z: Math.sin(t * 0.8) * 0.04 + (Math.random() - 0.5) * 0.01,
        timestamp: Date.now(),
      });
    }, 30);
    return () => clearInterval(id);
  }, [enabled]);

  return { accel, gyro };
}
