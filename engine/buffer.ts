export interface Sample3 {
  x: number;
  y: number;
  z: number;
  t: number; // ms
}

export class RingBuffer {
  private buf: Sample3[];
  private head = 0;
  private size = 0;
  constructor(public capacity: number) {
    this.buf = new Array(capacity);
  }

  push(s: Sample3) {
    this.buf[this.head] = s;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) this.size++;
  }

  get length() {
    return this.size;
  }

  toArray(): Sample3[] {
    const out: Sample3[] = [];
    for (let i = 0; i < this.size; i++) {
      const idx = (this.head - this.size + i + this.capacity) % this.capacity;
      out.push(this.buf[idx]);
    }
    return out;
  }

  // last N samples
  last(n: number): Sample3[] {
    const arr = this.toArray();
    return arr.slice(-n);
  }

  clear() {
    this.head = 0;
    this.size = 0;
  }

  latest(): Sample3 | null {
    if (this.size === 0) return null;
    const idx = (this.head - 1 + this.capacity) % this.capacity;
    return this.buf[idx];
  }
}

export function rms(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v * v;
  return Math.sqrt(sum / values.length);
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
