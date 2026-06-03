import { createContext, useContext, useState, useMemo, ReactNode, useEffect, useCallback } from 'react';
import { loadFromStorage, saveToStorage } from '../utils/storage';

export interface PredictionRecord {
  time: string;
  top3: number[];
  predictions: { number: number; probability: number; zodiac: string; color: string; element: string }[];
  modelContributions: { modelId: string; weight: number; topNumber: number }[];
}

const HISTORY_STORAGE_KEY = 'lottery_prediction_history';
const MAX_HISTORY_SIZE = 50;

interface PredictionHistoryCtx {
  history: PredictionRecord[];
  addPrediction: (record: PredictionRecord) => void;
  clearHistory: () => void;
}

const Ctx = createContext<PredictionHistoryCtx | null>(null);

export function PredictionHistoryProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<PredictionRecord[]>(() => {
    const saved = loadFromStorage<PredictionRecord[]>(HISTORY_STORAGE_KEY);
    return saved ?? [];
  });

  useEffect(() => {
    saveToStorage(history, HISTORY_STORAGE_KEY);
  }, [history]);

  const addPrediction = useCallback((record: PredictionRecord) => {
    setHistory(prev => [record, ...prev].slice(0, MAX_HISTORY_SIZE));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const value = useMemo<PredictionHistoryCtx>(() => ({
    history, addPrediction, clearHistory,
  }), [history, addPrediction, clearHistory]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePredictionHistory(): PredictionHistoryCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePredictionHistory must be inside PredictionHistoryProvider');
  return c;
}
