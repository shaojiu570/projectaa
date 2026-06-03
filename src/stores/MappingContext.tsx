import { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect } from 'react';
import {
  ZODIAC_NUMBERS as DEFAULT_ZODIAC_NUMBERS,
  COLOR_NUMBERS as DEFAULT_COLOR_NUMBERS,
  YEAR_ELEMENTS,
} from '../constants';
import { saveToStorage, loadFromStorage } from '../utils/storage';
import { getZodiacByDate as getZodiacByDateUtil, getYearZodiacMapping } from '../utils/lunarCalendar';

export type YearZodiacMap = Record<string, Record<string, number[]>>;

export function generateYearZodiacMap(startYear = 2020, endYear = 2030): YearZodiacMap {
  const result: YearZodiacMap = {};
  for (let year = startYear; year <= endYear; year++) {
    result[year] = getYearZodiacMapping(year);
  }
  return result;
}

interface MappingCtx {
  currentYear: number;
  setCurrentYear: (year: number) => void;
  yearZodiacMaps: YearZodiacMap;
  setYearZodiacMaps: React.Dispatch<React.SetStateAction<YearZodiacMap>>;
  zodiacNumbers: Record<string, number[]>;
  setZodiacNumbers: React.Dispatch<React.SetStateAction<Record<string, number[]>>>;
  updateYearZodiacMap: (year: number, map: Record<string, number[]>) => void;
  colorNumbers: Record<string, number[]>;
  setColorNumbers: React.Dispatch<React.SetStateAction<Record<string, number[]>>>;
  resetMappings: () => void;
  getZodiac: (n: number, year?: number) => string;
  getColor: (n: number) => string;
  getElement: (n: number, year?: number) => string;
  getZodiacByDate: (date: Date | string) => string;
  getZodiacByDateAndNumber: (date: Date | string, number: number) => string;
}

const Ctx = createContext<MappingCtx | null>(null);

function deepCloneMap(m: Record<string, number[]>): Record<string, number[]> {
  const r: Record<string, number[]> = {};
  for (const k of Object.keys(m)) r[k] = [...m[k]];
  return r;
}

export function MappingProvider({ children }: { children: ReactNode }) {
  const [currentYear, setCurrentYear] = useState(() => {
    const savedYear = loadFromStorage<number>('currentYear');
    return savedYear ?? new Date().getFullYear();
  });

  const [yearZodiacMaps, setYearZodiacMaps] = useState<YearZodiacMap>(() => {
    const saved = loadFromStorage<YearZodiacMap>('yearZodiacMaps');
    return saved ?? generateYearZodiacMap();
  });

  const zodiacNumbers = yearZodiacMaps[currentYear] ?? DEFAULT_ZODIAC_NUMBERS;

  const [colorNumbers, setColorNumbers] = useState(() => deepCloneMap(DEFAULT_COLOR_NUMBERS));

  useEffect(() => {
    saveToStorage(yearZodiacMaps, 'yearZodiacMaps');
  }, [yearZodiacMaps]);

  useEffect(() => {
    saveToStorage(currentYear, 'currentYear');
  }, [currentYear]);

  const updateYearZodiacMap = useCallback((year: number, map: Record<string, number[]>) => {
    setYearZodiacMaps(prev => ({
      ...prev,
      [year]: map,
    }));
  }, []);

  const setZodiacNumbers = useCallback((newMap: Record<string, number[]> | React.SetStateAction<Record<string, number[]>>) => {
    setYearZodiacMaps(prev => {
      const resolved = typeof newMap === 'function' ? newMap(prev[currentYear] ?? DEFAULT_ZODIAC_NUMBERS) : newMap;
      return {
        ...prev,
        [currentYear]: deepCloneMap(resolved),
      };
    });
  }, [currentYear]);

  const resetMappings = useCallback(() => {
    setYearZodiacMaps(generateYearZodiacMap());
    setColorNumbers(deepCloneMap(DEFAULT_COLOR_NUMBERS));
  }, []);

  const getZodiac = useCallback((num: number, year?: number): string => {
    const targetYear = year ?? currentYear;
    const map = yearZodiacMaps[targetYear] ?? DEFAULT_ZODIAC_NUMBERS;
    for (const [z, nums] of Object.entries(map)) {
      if (nums.includes(num)) return z;
    }
    return '未知';
  }, [yearZodiacMaps, currentYear]);

  const getZodiacByDate = useCallback((date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return getZodiacByDateUtil(dateObj);
  }, []);

  const getZodiacByDateAndNumber = useCallback((date: Date | string, number: number): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const year = dateObj.getFullYear();
    const map = getYearZodiacMapping(year);
    for (const [zodiac, numbers] of Object.entries(map)) {
      if (numbers.includes(number)) {
        return zodiac;
      }
    }
    return '未知';
  }, []);

  const getColor = useCallback((num: number): string => {
    for (const [c, nums] of Object.entries(colorNumbers)) {
      if (nums.includes(num)) return c;
    }
    return '未知';
  }, [colorNumbers]);

  const getElement = useCallback((num: number, year?: number): string => {
    const targetYear = year ?? currentYear;
    const yearData = YEAR_ELEMENTS[targetYear];
    if (!yearData) return '未知';
    for (const [element, nums] of Object.entries(yearData)) {
      if (nums.includes(num)) return element;
    }
    return '未知';
  }, [currentYear]);

  const value = useMemo<MappingCtx>(() => ({
    currentYear, setCurrentYear,
    yearZodiacMaps, setYearZodiacMaps,
    zodiacNumbers, setZodiacNumbers,
    updateYearZodiacMap,
    colorNumbers, setColorNumbers,
    resetMappings,
    getZodiac, getColor, getElement,
    getZodiacByDate, getZodiacByDateAndNumber,
  }), [
    currentYear, yearZodiacMaps, zodiacNumbers, colorNumbers,
    setZodiacNumbers, resetMappings, getZodiac, getColor, getElement, updateYearZodiacMap,
    getZodiacByDate, getZodiacByDateAndNumber,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMapping(): MappingCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useMapping must be inside MappingProvider');
  return c;
}
