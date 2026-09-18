// Edge deployable 200Hz FOG IMU bridge via WebSocket
// Phone mobile app: client, Edge engine: server (external IMU 200Hz)
// Protocol: JSON {t, ax,ay,az,gx,gy,gz, seq}

export type EdgeSample = {
  t: number;
  ax: number; ay: number; az: number;
  gx: number; gy: number; gz: number;
  seq?: number;
};

export type EdgeStatus = "disconnected" | "connecting" | "connected" | "error";

export class EdgeBridge {
  ws: WebSocket | null = null;
  status: EdgeStatus = "disconnected";
  url: string | null = null;
  sampleCount = 0;
  hz = 0;
  private lastHzAt = Date.now();
  private countSince = 0;
  onSample?: (s: EdgeSample) => void;
  onStatus?: (s: EdgeStatus) => void;

  connect(url: string) {
    this.url = url;
    this.status = "connecting";
    this.onStatus?.(this.status);
    try {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        this.status = "connected";
        this.onStatus?.(this.status);
      };
      this.ws.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data);
          const s: EdgeSample = {
            t: d.t ?? Date.now(),
            ax: d.ax, ay: d.ay, az: d.az,
            gx: d.gx, gy: d.gy, gz: d.gz,
            seq: d.seq,
          };
          this.sampleCount++;
          this.countSince++;
          const now = Date.now();
          if (now - this.lastHzAt > 500) {
            this.hz = (this.countSince / (now - this.lastHzAt)) * 1000;
            this.countSince = 0;
            this.lastHzAt = now;
          }
          this.onSample?.(s);
        } catch {}
      };
      this.ws.onerror = () => {
        this.status = "error";
        this.onStatus?.(this.status);
      };
      this.ws.onclose = () => {
        this.status = "disconnected";
        this.onStatus?.(this.status);
      };
    } catch {
      this.status = "error";
      this.onStatus?.(this.status);
    }
  }

  disconnect() {
    try { this.ws?.close(); } catch {}
    this.ws = null;
    this.status = "disconnected";
    this.onStatus?.(this.status);
  }

  // mock generator for demo without external hardware: 200Hz synth
  mock(on: boolean, cb: (s: EdgeSample) => void) {
    if (!on) return () => {};
    let seq = 0;
    let t = 0;
    const id = setInterval(() => {
      t += 0.005;
      cb({
        t: Date.now(),
        ax: Math.sin(t * 3) * 0.3 + (Math.random() - 0.5) * 0.2,
        ay: Math.cos(t * 2.5) * 0.2 + (Math.random() - 0.5) * 0.15,
        az: 9.81 + Math.sin(t * 9) * 0.12 + (Math.random() - 0.5) * 0.15,
        gx: Math.sin(t * 1.6) * 0.01,
        gy: Math.cos(t * 1.3) * 0.01,
        gz: Math.sin(t * 0.9) * 0.02 + (Math.random() - 0.5) * 0.006,
        seq: seq++,
      });
    }, 5); // 200Hz
    return () => clearInterval(id);
  }
}

export const edgeBridge = new EdgeBridge();
