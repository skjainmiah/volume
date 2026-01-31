import { create } from 'zustand';

export interface SystemStatus {
  marketStatus: 'OPEN' | 'CLOSED';
  tradingMode: 'PAPER' | 'REAL';
  systemState: 'RUNNING' | 'PAUSED' | 'EMERGENCY_STOP';
  riskUsageToday: number;
}

export interface DashboardStats {
  todayPnlPaper: number;
  todayPnlReal: number;
  activeTradesCount: number;
  activeRadarCount: number;
  nearDecisionCount: number;
  lastSystemAction: string;
}

interface AppState {
  systemStatus: SystemStatus;
  dashboardStats: DashboardStats | null;
  isLoading: boolean;
  error: string | null;

  setSystemStatus: (status: Partial<SystemStatus>) => void;
  setDashboardStats: (stats: DashboardStats) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  emergencyStop: () => void;
}

export const useStore = create<AppState>((set) => ({
  systemStatus: {
    marketStatus: 'CLOSED',
    tradingMode: 'PAPER',
    systemState: 'PAUSED',
    riskUsageToday: 0,
  },
  dashboardStats: null,
  isLoading: false,
  error: null,

  setSystemStatus: (status) =>
    set((state) => ({
      systemStatus: { ...state.systemStatus, ...status }
    })),

  setDashboardStats: (stats) => set({ dashboardStats: stats }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  emergencyStop: () =>
    set((state) => ({
      systemStatus: {
        ...state.systemStatus,
        systemState: 'EMERGENCY_STOP',
        tradingMode: 'PAPER',
      }
    })),
}));
