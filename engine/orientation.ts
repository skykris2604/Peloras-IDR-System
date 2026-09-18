export interface Euler {
  pitch: number; // deg
  roll: number;
  yaw: number;
}

// rotate vector by calibration euler (phone -> vehicle)
// order: yaw (Z), pitch (X), roll (Y) - approximate for small angles fast path
export function rotateToVehicle(v: { x: number; y: number; z: number }, e: Euler) {
  const pr = (e.pitch * Math.PI) / 180;
  const rr = (e.roll * Math.PI) / 180;
  const yr = (e.yaw * Math.PI) / 180;

  // Yaw Z
  let x1 = v.x * Math.cos(yr) - v.y * Math.sin(yr);
  let y1 = v.x * Math.sin(yr) + v.y * Math.cos(yr);
  let z1 = v.z;

  // Pitch X
  let y2 = y1 * Math.cos(pr) - z1 * Math.sin(pr);
  let z2 = y1 * Math.sin(pr) + z1 * Math.cos(pr);
  let x2 = x1;

  // Roll Y
  let x3 = x2 * Math.cos(rr) + z2 * Math.sin(rr);
  let z3 = -x2 * Math.sin(rr) + z2 * Math.cos(rr);
  let y3 = y2;

  return { x: x3, y: y3, z: z3 };
}

// NHC: zero lateral & vertical velocity gate
export function applyNHC(velVehicle: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  // vehicle x = forward, y = lateral, z = vertical
  // force y=0, z=0
  return { x: velVehicle.x, y: 0, z: 0 };
}

export function gravityCompensate(accVehicle: { x: number; y: number; z: number }, gravity = 9.81) {
  // assume z is vertical in vehicle frame, remove gravity
  return { x: accVehicle.x, y: accVehicle.y, z: accVehicle.z - gravity };
}
