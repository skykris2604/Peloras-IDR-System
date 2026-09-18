import { create } from "zustand";

export interface ImuDiagnostics {
  rateHz: number;
  bufferFill: number;
  potholeCount: number;
  vibrationFlag: boolean;
  vibeRms: number;
  forwardAcc: number;
  speedEst: number;
  bias: number;
  stationaryProb: number;
  lastFilteredAt: number;
}

interface ImuState {
  diagnostics: ImuDiagnostics;
  rawHz: number;
  filteredHz: number;
  setDiagnostics: (d: Partial<ImuDiagnostics>) => void;
  incPothole: () => void;
  setRates: (raw: number, filtered: number) => void;
}

export const useImuStore = create<ImuState>((set) => ({
  diagnostics: {
    rateHz: 0,
    bufferFill: 0,
    potholeCount: 0,
    vibrationFlag: false,
    vibeRms: 0,
    forwardAcc: 0,
    speedEst: 0,
    bias: 0,
    stationaryProb: 0,
    lastFilteredAt: 0,
  },
  rawHz: 0,
  filteredHz: 0,
  setDiagnostics: (d) => set((s) => ({ diagnostics: { ...s.diagnostics, ...d } })),
  incPothole: () => set((s) => ({ diagnostics: { ...s.diagnostics, potholeCount: s.diagnostics.potholeCount + 1 } })),
  setRates: (raw, filtered) => set({ rawHz: raw, filteredHz: filtered }),
}));
