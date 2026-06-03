import { createContext, useContext, useState, useMemo, ReactNode, useEffect, useCallback } from 'react';
import { loadFromStorage, saveToStorage } from '../utils/storage';

export interface FunnelConfig {
  level1KeepRatio: number;
  zodiacTopK: number;
  level2KeepCount: number;
  level3OutputCount: number;
  useMarkovForZodiac: boolean;
  zodiacFusionAlpha: number;
}

export const DEFAULT_FUNNEL: FunnelConfig = {
  level1KeepRatio: 0.6,
  zodiacTopK: 3,
  level2KeepCount: 15,
  level3OutputCount: 10,
  useMarkovForZodiac: true,
  zodiacFusionAlpha: 0.5,
};

const FUNNEL_STORAGE_KEY = 'lottery_funnel_config';

interface FunnelCtx {
  funnelConfig: FunnelConfig;
  setFunnelConfig: React.Dispatch<React.SetStateAction<FunnelConfig>>;
  resetFunnel: () => void;
}

const Ctx = createContext<FunnelCtx | null>(null);

export function FunnelProvider({ children }: { children: ReactNode }) {
  const [funnelConfig, setFunnelConfig] = useState<FunnelConfig>(() => {
    const saved = loadFromStorage<FunnelConfig>(FUNNEL_STORAGE_KEY);
    return saved ?? { ...DEFAULT_FUNNEL };
  });

  useEffect(() => {
    saveToStorage(funnelConfig, FUNNEL_STORAGE_KEY);
  }, [funnelConfig]);

  const resetFunnel = useCallback(() => {
    setFunnelConfig({ ...DEFAULT_FUNNEL });
  }, []);

  const value = useMemo<FunnelCtx>(() => ({
    funnelConfig, setFunnelConfig, resetFunnel,
  }), [funnelConfig, resetFunnel]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFunnel(): FunnelCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useFunnel must be inside FunnelProvider');
  return c;
}
