const DEFAULT_STORAGE_KEY = 'lottery_prediction_data';
const STORAGE_VERSION = '1.0';

interface StorageData {
  version: string;
  data: unknown;
  timestamp: number;
}

export function saveToStorage<T>(data: T, key?: string): void {
  const storageKey = key ?? DEFAULT_STORAGE_KEY;
  try {
    const payload: StorageData = {
      version: STORAGE_VERSION,
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    console.warn('Failed to save to localStorage');
  }
}

export function loadFromStorage<T>(key?: string): T | null {
  const storageKey = key ?? DEFAULT_STORAGE_KEY;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed: StorageData = JSON.parse(raw);
    if (parsed.version !== STORAGE_VERSION) {
      console.warn('Storage version mismatch, clearing old data');
      localStorage.removeItem(storageKey);
      return null;
    }
    return parsed.data as T;
  } catch {
    return null;
  }
}

export function clearStorage(key?: string): void {
  const storageKey = key ?? DEFAULT_STORAGE_KEY;
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
}

export function exportDataToFile(data: unknown, filename = 'lottery_data.json'): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function importDataFromFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target?.result as string);
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
