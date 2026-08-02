import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { getUnifiedModels } from '../models/library';
import { saveToStorage, loadFromStorage } from '../utils/storage';

export type SeparatedModelType = 'number' | 'zodiac' | 'head' | 'tail' | 'element';
export interface SelectedModel { id: string; weight: number; }
export type SeparatedSelections = Record<SeparatedModelType, SelectedModel[]>;

export interface SeparatedModelInfo { id: string; name: string; desc: string; isGeneric?: boolean; }

const MODEL_TYPES: SeparatedModelType[] = ['number', 'zodiac', 'head', 'tail', 'element'];

const STORAGE_KEY = 'separated_selected_models_v1';
const AUTO_WEIGHT_KEY = 'separated_auto_weight';

export interface SeparatedModelContextType {
  selections: SeparatedSelections;
  availableModels: Record<SeparatedModelType, SeparatedModelInfo[]>;
  addModel: (type: SeparatedModelType, id: string) => void;
  removeModel: (type: SeparatedModelType, id: string) => void;
  setModelWeight: (type: SeparatedModelType, id: string, weight: number) => void;
  setModels: (type: SeparatedModelType, models: SelectedModel[]) => void;
  applyWeights: (type: SeparatedModelType, weights: { id: string; weight: number }[]) => void;
  resetSeparatedModels: () => void;
  autoWeightOptimization: boolean;
  setAutoWeightOptimization: (enabled: boolean) => void;
}

function getTypeModels(type: SeparatedModelType): (SeparatedModelInfo & { defaultWeight: number })[] {
  return getUnifiedModels(type).map(m => ({
    id: m.id,
    name: m.name,
    desc: m.desc,
    isGeneric: m.kind === 'generic',
    defaultWeight: m.defaultWeight,
  }));
}

function buildDefaultSelections(): SeparatedSelections {
  const result = {} as SeparatedSelections;
  for (const type of MODEL_TYPES) {
    result[type] = [];
  }
  return result;
}

interface PersistedState {
  version: number;
  selections: SeparatedSelections;
}

function loadPersisted(): SeparatedSelections {
  const saved = loadFromStorage<PersistedState>(STORAGE_KEY);
  const defaults = buildDefaultSelections();
  if (!saved || saved.version !== 1 || !saved.selections) return defaults;
  for (const type of MODEL_TYPES) {
    const savedList = saved.selections[type];
    if (!Array.isArray(savedList) || savedList.length === 0) continue;
    const validIds = new Set(getTypeModels(type).map(m => m.id));
    const filtered = savedList
      .filter(s => validIds.has(s.id))
      .map(s => ({ id: s.id, weight: s.weight }));
    if (filtered.length > 0) defaults[type] = filtered;
  }
  return defaults;
}

const Ctx = createContext<SeparatedModelContextType | null>(null);

export function SeparatedModelProvider({ children }: { children: ReactNode }) {
  const [selections, setSelections] = useState<SeparatedSelections>(loadPersisted);
  const [autoWeightOptimization, setAutoWeightEnabled] = useState<boolean>(() => {
    const saved = loadFromStorage<boolean>(AUTO_WEIGHT_KEY);
    return saved ?? true;
  });

  const availableModels = {} as Record<SeparatedModelType, SeparatedModelInfo[]>;
  for (const type of MODEL_TYPES) {
    availableModels[type] = getTypeModels(type).map(({ id, name, desc, isGeneric }) => ({ id, name, desc, isGeneric }));
  }

  useEffect(() => {
    saveToStorage({ version: 1, selections }, STORAGE_KEY);
  }, [selections]);

  useEffect(() => {
    saveToStorage(autoWeightOptimization, AUTO_WEIGHT_KEY);
  }, [autoWeightOptimization]);

  const addModel = useCallback((type: SeparatedModelType, id: string) => {
    setSelections(prev => {
      if (prev[type].some(m => m.id === id)) return prev;
      const info = getTypeModels(type).find(m => m.id === id);
      return {
        ...prev,
        [type]: [...prev[type], { id, weight: info ? info.defaultWeight : 0.1 }],
      };
    });
  }, []);

  const removeModel = useCallback((type: SeparatedModelType, id: string) => {
    setSelections(prev => ({
      ...prev,
      [type]: prev[type].filter(m => m.id !== id),
    }));
  }, []);

  const setModelWeight = useCallback((type: SeparatedModelType, id: string, weight: number) => {
    setSelections(prev => ({
      ...prev,
      [type]: prev[type].map(m => m.id === id ? { ...m, weight } : m),
    }));
  }, []);

  const setModels = useCallback((type: SeparatedModelType, models: SelectedModel[]) => {
    setSelections(prev => ({ ...prev, [type]: models }));
  }, []);

  const applyWeights = useCallback((type: SeparatedModelType, weights: { id: string; weight: number }[]) => {
    setSelections(prev => ({
      ...prev,
      [type]: prev[type].map(m => {
        const found = weights.find(w => w.id === m.id);
        return found ? { ...m, weight: found.weight } : m;
      }),
    }));
  }, []);

  const resetSeparatedModels = useCallback(() => {
    setSelections(buildDefaultSelections());
  }, []);

  const value: SeparatedModelContextType = {
    selections, availableModels,
    addModel, removeModel, setModelWeight, setModels, applyWeights,
    resetSeparatedModels, autoWeightOptimization, setAutoWeightOptimization: setAutoWeightEnabled,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSeparatedModel(): SeparatedModelContextType {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSeparatedModel must be inside SeparatedModelProvider');
  return c;
}
