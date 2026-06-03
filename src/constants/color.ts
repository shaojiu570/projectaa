export const COLOR_NUMBERS: Record<string, number[]> = {
  '红波': [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46],
  '蓝波': [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48],
  '绿波': [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49],
};

export function getColor(num: number): string {
  for (const [color, nums] of Object.entries(COLOR_NUMBERS)) {
    if (nums.includes(num)) return color;
  }
  return '未知';
}

export function getColorClass(num: number): string {
  const c = getColor(num);
  if (c === '红波') return 'bg-red-500 text-white';
  if (c === '蓝波') return 'bg-blue-500 text-white';
  if (c === '绿波') return 'bg-green-500 text-white';
  return 'bg-gray-500 text-white';
}
