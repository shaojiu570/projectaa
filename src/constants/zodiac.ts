export const ZODIACS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'] as const;
export type Zodiac = typeof ZODIACS[number];

export const ZODIAC_NUMBERS: Record<string, number[]> = {
  '鼠': [1, 13, 25, 37, 49],
  '牛': [2, 14, 26, 38],
  '虎': [3, 15, 27, 39],
  '兔': [4, 16, 28, 40],
  '龙': [5, 17, 29, 41],
  '蛇': [6, 18, 30, 42],
  '马': [7, 19, 31, 43],
  '羊': [8, 20, 32, 44],
  '猴': [9, 21, 33, 45],
  '鸡': [10, 22, 34, 46],
  '狗': [11, 23, 35, 47],
  '猪': [12, 24, 36, 48],
};

export function getZodiac(num: number): string {
  for (const [zodiac, nums] of Object.entries(ZODIAC_NUMBERS)) {
    if (nums.includes(num)) return zodiac;
  }
  return '未知';
}
