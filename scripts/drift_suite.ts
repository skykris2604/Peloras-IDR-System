import { synthIoRows } from "../engine/ioVnbd";
import { runPlayback } from "../engine/playbackRunner";

const scenarios = [
  { id: "50m", dist: 50, speed: 5.5, outage: 50 },
  { id: "1km", dist: 1000, speed: 16.6, outage: 1000 },
  { id: "2.3km", dist: 2300, speed: 8.3, outage: 1200 },
  { id: "400m-parking", dist: 400, speed: 5.5, outage: 400 },
];

let allPass = true;
for (const s of scenarios) {
  const rows = synthIoRows(s.dist, Math.min(150, s.dist * 0.15), s.outage, s.speed);
  const r = runPlayback(rows, { pitch: 2.1, roll: -0.8, yaw: 4.5 });
  const pass = r.pass;
  allPass &&= pass;
  console.log(`${s.id}: drift ${r.drift.toFixed(2)}m / ${s.dist}m = ${r.driftPct.toFixed(2)}% ${pass ? "PASS" : "FAIL"}`);
}
process.exit(allPass ? 0 : 1);
