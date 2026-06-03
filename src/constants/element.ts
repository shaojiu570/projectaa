export const YEAR_ELEMENTS: Record<number, Record<string, number[]>> = {
  2020: {
    '金': [6, 7, 20, 21, 28, 29, 36, 37],
    '木': [2, 3, 10, 11, 18, 19, 32, 33, 40, 41, 48],
    '水': [8, 9, 16, 17, 24, 25, 38, 39, 46, 47],
    '火': [4, 5, 12, 13, 26, 27, 34, 35, 42, 43],
    '土': [1, 14, 15, 22, 23, 30, 31, 44, 45],
  },
  2021: {
    '金': [7, 8, 21, 22, 29, 30, 37, 38],
    '木': [3, 4, 11, 12, 19, 20, 33, 34, 41, 42, 49],
    '水': [9, 10, 17, 18, 25, 26, 39, 40, 47, 48],
    '火': [5, 6, 13, 14, 27, 28, 35, 36, 43, 44],
    '土': [1, 2, 15, 16, 23, 24, 31, 32, 45, 46],
  },
  2022: {
    '金': [1, 8, 9, 22, 23, 30, 31, 38, 39],
    '木': [4, 5, 12, 13, 20, 21, 34, 35, 42, 43],
    '水': [10, 11, 18, 19, 26, 27, 40, 41, 48, 49],
    '火': [6, 7, 14, 15, 28, 29, 36, 37, 44, 45],
    '土': [2, 3, 16, 17, 24, 25, 32, 33, 46, 47],
  },
  2023: {
    '金': [1, 2, 9, 10, 23, 24, 31, 32, 39, 40],
    '木': [5, 6, 13, 14, 21, 22, 35, 36, 43, 44],
    '水': [11, 12, 19, 20, 27, 28, 41, 42, 49],
    '火': [7, 8, 15, 16, 29, 30, 37, 38, 45, 46],
    '土': [3, 4, 17, 18, 25, 26, 33, 34, 47, 48],
  },
  2024: {
    '金': [2, 3, 10, 11, 24, 25, 32, 33, 40, 41],
    '木': [6, 7, 14, 15, 22, 23, 36, 37, 44, 45],
    '水': [12, 13, 20, 21, 28, 29, 42, 43],
    '火': [1, 8, 9, 16, 17, 30, 31, 38, 39, 46, 47],
    '土': [4, 5, 18, 19, 26, 27, 34, 35, 48, 49],
  },
  2025: {
    '金': [3, 4, 11, 12, 25, 26, 33, 34, 41, 42],
    '木': [7, 8, 15, 16, 23, 24, 37, 38, 45, 46],
    '水': [13, 14, 21, 22, 29, 30, 43, 44],
    '火': [1, 2, 9, 10, 17, 18, 31, 32, 39, 40, 47, 48],
    '土': [5, 6, 19, 20, 27, 28, 35, 36, 49],
  },
  2026: {
    '金': [4, 5, 12, 13, 26, 27, 34, 35, 42, 43],
    '木': [8, 9, 16, 17, 24, 25, 38, 39, 46, 47],
    '水': [1, 14, 15, 22, 23, 30, 31, 44, 45],
    '火': [2, 3, 10, 11, 18, 19, 32, 33, 40, 41, 48, 49],
    '土': [6, 7, 20, 21, 28, 29, 36, 37],
  },
};

export const ELEMENTS = ['金', '木', '水', '火', '土'] as const;

export function getElement(num: number, year?: number): string {
  const y = year || new Date().getFullYear();
  const yearData = YEAR_ELEMENTS[y];
  if (!yearData) return '未知';
  for (const [element, nums] of Object.entries(yearData)) {
    if (nums.includes(num)) return element;
  }
  return '未知';
}

export function getElementColor(element: string): string {
  switch (element) {
    case '金': return 'text-yellow-500';
    case '木': return 'text-green-600';
    case '水': return 'text-blue-500';
    case '火': return 'text-red-500';
    case '土': return 'text-amber-700';
    default: return 'text-gray-500';
  }
}

export function getElementBg(element: string): string {
  switch (element) {
    case '金': return 'bg-yellow-100 border-yellow-400';
    case '木': return 'bg-green-100 border-green-400';
    case '水': return 'bg-blue-100 border-blue-400';
    case '火': return 'bg-red-100 border-red-400';
    case '土': return 'bg-amber-100 border-amber-400';
    default: return 'bg-gray-100 border-gray-400';
  }
}
