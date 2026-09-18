// Edge-deployable standalone IDR engine — runs without React Native / Expo.
// Works with any IMU via plain JS objects. Used by phone app and external FOG server.
// No imports from expo-* or react-native.

import { RingBuffer } from "./buffer";
import { createFilterState, filterSample } from "./vibrationFilter";
import { rotateToVehicle, gravityCompensate } from "./orientation";
import { createSpeedState, estimateSpeed } from "./speedEstimator";
import { fuse, resetFusion } from "./fusion";
import { matchPosition, resetMatcher } from "./mapMatcher";
import { LatLng } from "../store/navStore";

export interface ImuSample {
  t: number; // ms epoch
  ax: number; ay: number; az: number;
  gx: number; gy: number; gz: number;
  mx?: number; my?: number; mz?: number;
}

export interface GnssSample {
  t: number;
  lat: number; lon: number;
  accuracy: number; // m
  speed?: number; // m/s
  heading?: number; // deg
}

export interface EdgeConfig {
  pitch: number; roll: number; yaw: number; // calibration
  imuRate: number; // Hz, 100 phone / 200 FOG
  fusionRate: number; // Hz, 10 phone / 200 edge (will downsample)
  useMapMatch: boolean;
  useVibrationFilter: boolean; // false for FOG (bypass)
}

export const defaultPhoneConfig: EdgeConfig = {
  pitch: 2.1, roll: -0.8, yaw: 4.5,
  imuRate: 100,
  fusionRate: 10,
  useMapMatch: true,
  useVibrationFilter: true,
};

export const defaultFogConfig: EdgeConfig = {
  pitch: 0, roll: 0, yaw: 0,
  imuRate: 200,
  fusionRate: 200,
  useMapMatch: true,
  useVibrationFilter: false, // FOG clean, bypass notch
};

export class IdrEngine {
  cfg: EdgeConfig;
  filterState = createFilterState();
  speedState = createSpeedState();
  imuBuf = new RingBuffer(1024);
  gyroBuf = new RingBuffer(1024);
  lastFusionAt = 0;
  started = false;

  // output state
  position: LatLng = { latitude: 18.5204, longitude: 73.8567 };
  heading = 42;
  speed = 0;
  drift = 0;
  driftPct = 0;
  distance = 0;
  gnssStatus: "FIX" | "OUTAGE" = "FIX";
  mode: "GNSS" | "IDR" | "FUSION" = "GNSS";
  isSnapped = false;
  snapRoad: string | null = null;

  onOutput?: (out: {
    position: LatLng; heading: number; speed: number;
    drift: number; driftPct: number; distance: number;
    mode: string; gnssStatus: string; isSnapped: boolean; snapRoad: string | null;
  }) => void;

  constructor(cfg: Partial<EdgeConfig> = {}) {
    this.cfg = { ...defaultPhoneConfig, ...cfg };
    resetFusion(this.position.latitude, this.position.longitude, this.heading, 8.3);
    resetMatcher();
  }

  configure(patch: Partial<EdgeConfig>) {
    this.cfg = { ...this.cfg, ...patch };
  }

  setCalibration(pitch: number, roll: number, yaw: number) {
    this.cfg.pitch = pitch; this.cfg.roll = roll; this.cfg.yaw = yaw;
  }

  // feed IMU at native rate (100/200Hz). Internally downsamples to fusionRate.
  feedImu(s: ImuSample) {
    const imu = { x: s.ax, y: s.ay, z: s.az, t: s.t };
    const gyro = { x: s.gx, y: s.gy, z: s.gz, t: s.t };
    this.imuBuf.push(imu);
    this.gyroBuf.push(gyro);

    const now = s.t;
    const interval = 1000 / this.cfg.fusionRate;
    if (now - this.lastFusionAt < interval) return;
    this.lastFusionAt = now;

    // filter or bypass
    let filtered = imu;
    let isPothole = false;
    let isVibe = false;
    if (this.cfg.useVibrationFilter) {
      const res = filterSample(imu, this.filterState);
      filtered = res.filtered;
      isPothole = res.isPothole;
      isVibe = res.isVibration;
    } else {
      // FOG: light LPF only
      filtered = imu;
    }

    const euler = { pitch: this.cfg.pitch, roll: this.cfg.roll, yaw: this.cfg.yaw };
    const accVeh = rotateToVehicle(filtered, euler);
    const accComp = gravityCompensate(accVeh);
    const gyroVeh = rotateToVehicle(gyro, euler);
    const gyroNorm = Math.sqrt(gyroVeh.x ** 2 + gyroVeh.y ** 2 + gyroVeh.z ** 2);

    // speed est (FOG can use tighter)
    const dt = interval / 1000;
    estimateSpeed(accComp.x, gyroNorm, dt, this.speedState);

    // NOTE: actual GNSS feed comes via feedGnss or via fuse step below with last GNSS
    // For standalone without GNSS thread, we fuse with no GNSS (IDR) here; caller should call tick()
    // To keep single entry, we do fuse-then-match here with no GNSS (will be corrected when GNSS arrives)
    this.tickInternal(accComp.x, gyroVeh.z, dt, isPothole);
  }

  lastGnss: GnssSample | null = null;
  gnssTimeoutMs = 1500;

  feedGnss(g: GnssSample) {
    this.lastGnss = g;
  }

  // explicit tick used by phone loop at 10Hz when you want to drive fusion with latest IMU+GNSS together
  tick(dt: number, forwardAcc: number, gyroYaw: number, isPothole: boolean) {
    this.tickInternal(forwardAcc, gyroYaw, dt, isPothole);
  }

  private tickInternal(forwardAcc: number, gyroYaw: number, dt: number, isPothole: boolean) {
    const now = Date.now();
    const gnssAge = this.lastGnss ? now - this.lastGnss.t : Infinity;
    const hasGnss = this.lastGnss && gnssAge < this.gnssTimeoutMs;

    const gnss = hasGnss ? {
      lat: this.lastGnss!.lat, lon: this.lastGnss!.lon,
      accuracy: this.lastGnss!.accuracy, speed: this.lastGnss!.speed,
    } : undefined;

    const res = fuse({ accel: { x: forwardAcc, y: 0, z: 9.81 }, gyro: { x: 0, y: 0, z: gyroYaw }, gnss, dt });

    let heading = res.heading;
    if (!hasGnss) heading = (heading + gyroYaw * dt * 180 / Math.PI * 0.9) % 360;
    if (heading < 0) heading += 360;

    const speed = this.speedState.speed > 0 ? this.speedState.speed : res.speed;

    const raw = {
      latitude: res.lat + (isPothole ? 0.00002 : 0),
      longitude: res.lon,
    };

    let snapped = raw;
    let isSnapped = false;
    let road: string | null = null;
    let rawDist = 0;

    if (this.cfg.useMapMatch) {
      const m = matchPosition(raw, heading, speed, !!hasGnss);
      snapped = m.snapped;
      isSnapped = m.isSnapped;
      road = m.candidate?.name ?? null;
      rawDist = m.rawDist;
      if (!hasGnss && isSnapped) {
        const conf = Math.max(0, 1 - rawDist / 25);
        const corr = fuse({ accel: { x: 0, y: 0, z: 0 }, gyro: { x: 0, y: 0, z: 0 }, mapPseudo: { lat: m.snapped.latitude, lon: m.snapped.longitude, dist: rawDist, confidence: conf }, dt: 0 });
        snapped = { latitude: corr.lat, longitude: corr.lon };
      }
      if (isSnapped && m.candidate && m.candidate.bearingDiff < 20) {
        const diff = ((m.candidate.bearing - heading + 540) % 360) - 180;
        heading = (heading + diff * 0.3 + 360) % 360;
      }
    }

    const displayPos = isSnapped ? snapped : raw;

    // distance/drift
    if (!hasGnss) {
      this.distance += speed * dt;
      const err = Math.hypot(raw.latitude - snapped.latitude, raw.longitude - snapped.longitude) * 111000; // approx
      this.drift = this.drift * 0.85 + err * 0.15;
    } else {
      this.distance += speed * dt;
      this.drift *= 0.92;
    }
    this.driftPct = this.distance > 0 ? (this.drift / this.distance) * 100 : 0;

    this.position = displayPos;
    this.heading = heading;
    this.speed = speed;
    this.gnssStatus = hasGnss ? "FIX" : "OUTAGE";
    this.mode = res.mode;
    this.isSnapped = isSnapped;
    this.snapRoad = road;

    this.onOutput?.({
      position: this.position,
      heading: this.heading,
      speed: this.speed,
      drift: this.drift,
      driftPct: this.driftPct,
      distance: this.distance,
      mode: this.mode,
      gnssStatus: this.gnssStatus,
      isSnapped: this.isSnapped,
      snapRoad: this.snapRoad,
    });
  }

  reset(lat = 18.5204, lon = 73.8567, heading = 42, speed = 8.3) {
    this.position = { latitude: lat, longitude: lon };
    this.heading = heading;
    this.speed = speed;
    this.distance = 0; this.drift = 0; this.driftPct = 0;
    this.imuBuf.clear(); this.gyroBuf.clear();
    this.filterState = createFilterState();
    this.speedState = createSpeedState();
    this.speedState.speed = speed;
    resetFusion(lat, lon, heading, speed);
    resetMatcher();
  }
}
