import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { AlgorithmConfig } from '../models/dynamic/types';
import { PREDEFINED_ALGOS } from '../models/dynamic';

interface ModelLibraryCtx {
  algorithms: AlgorithmConfig[];
  setAlgorithms: (algos: AlgorithmConfig[]) => void;
  toggleAlgo: (id: string) => void;
  setAlgoWeight: (id: string, weight: number) => void;
  resetAlgorithms: () => void;
}

const Ctx = createContext<ModelLibraryCtx | null>(null);

export function ModelLibraryProvider({ children }: { children: ReactNode }) {
  const [algorithms, setAlgorithms] = useState<AlgorithmConfig[]>(() => {
    try {
      const saved = localStorage.getItem('lottery_model_library');
      if (saved) return JSON.parse(saved);
      return PREDEFINED_ALGOS.map(a => ({ ...a, weight: 1 }));
    } catch { return PREDEFINED_ALGOS.map(a => ({ ...a, weight: 1 })); }
  });

  const persist = (u: AlgorithmConfig[]) => {
    localStorage.setItem('lottery_model_library', JSON.stringify(u));
    setAlgorithms(u);
  };

  const toggleAlgo = useCallback((id: string) => {
    setAlgorithms(prev => {
      const next = prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a);
      localStorage.setItem('lottery_model_library', JSON.stringify(next));
      return next;
    });
  }, []);

  const setAlgoWeight = useCallback((id: string, weight: number) => {
    setAlgorithms(prev => {
      const next = prev.map(a => a.id === id ? { ...a, weight: Math.max(0, Math.min(1, weight)) } : a);
      localStorage.setItem('lottery_model_library', JSON.stringify(next));
      return next;
    });
  }, []);

  const resetAlgorithms = useCallback(() => {
    const defs = PREDEFINED_ALGOS.map(a => ({ ...a, weight: 1 }));
    localStorage.setItem('lottery_model_library', JSON.stringify(defs));
    setAlgorithms(defs);
  }, []);

  const value = useMemo(() => ({
    algorithms, setAlgorithms: persist, toggleAlgo, setAlgoWeight, resetAlgorithms,
  }), [algorithms]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useModelLibrary(): ModelLibraryCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useModelLibrary must be inside ModelLibraryProvider');
  return c;
}
