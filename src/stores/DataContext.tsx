import { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect } from 'react';
import { DrawRecord } from '../data/types';
import { completeHistoricalData } from '../data/historicalData';
import { saveToStorage, loadFromStorage } from '../utils/storage';
import { syncFromBackend as syncFromBackendService } from '../services/sync';

interface DataCtx {
  data: DrawRecord[];
  setData: React.Dispatch<React.SetStateAction<DrawRecord[]>>;
  addRecord: (r: DrawRecord) => void;
  removeRecord: (issue: string) => void;
  removeRecords: (issues: string[]) => void;
  resetData: () => void;
  clearAllData: () => void;
  syncFromBackend: () => Promise<void>;
}

const Ctx = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DrawRecord[]>(() => {
    const saved = loadFromStorage<DrawRecord[]>();
    return saved ?? completeHistoricalData;
  });

  useEffect(() => {
    saveToStorage(data);
  }, [data]);

  const syncFromBackend = useCallback(async () => {
    const convertedData = await syncFromBackendService();
    if (convertedData.length > 0) {
      setData(prev => {
        const hasRealData = convertedData.some(d => parseInt(d.date.slice(0, 4)) >= 2023);
        const filteredPrev = hasRealData ? prev.filter(d => parseInt(d.date.slice(0, 4)) >= 2023) : prev;
        const combined = [...filteredPrev, ...convertedData];
        const uniqueMap = new Map(combined.map(item => [item.issue, item]));
        return Array.from(uniqueMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      });
      console.log(`成功从后端同步 ${convertedData.length} 条数据`);
    }
  }, [setData]);

  useEffect(() => {
    syncFromBackend();
  }, [syncFromBackend]);

  const addRecord = useCallback((r: DrawRecord) => {
    setData(prev => {
      if (prev.some(d => d.issue === r.issue)) return prev;
      return [...prev, r].sort((a, b) => a.date.localeCompare(b.date));
    });
  }, []);

  const removeRecord = useCallback((issue: string) => {
    setData(prev => prev.filter(d => d.issue !== issue));
  }, []);

  const removeRecords = useCallback((issues: string[]) => {
    setData(prev => prev.filter(d => !issues.includes(d.issue)));
  }, []);

  const resetData = useCallback(() => setData(completeHistoricalData), []);

  const clearAllData = useCallback(() => setData([]), []);

  const value = useMemo<DataCtx>(() => ({
    data, setData, addRecord, removeRecord, removeRecords, resetData, clearAllData, syncFromBackend
  }), [data, addRecord, removeRecord, removeRecords, resetData, clearAllData, syncFromBackend]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData must be inside DataProvider');
  return c;
}
