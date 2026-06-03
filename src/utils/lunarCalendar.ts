const ZODIACS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

function getLichunDate(year: number): Date {
  const lichunDates: Record<number, [number, number, number, number]> = {
    2020: [2, 4, 17, 3],
    2021: [2, 3, 22, 58],
    2022: [2, 4, 4, 50],
    2023: [2, 4, 10, 42],
    2024: [2, 4, 16, 26],
    2025: [2, 3, 22, 10],
    2026: [2, 4, 3, 59],
    2027: [2, 4, 9, 46],
    2028: [2, 4, 15, 31],
    2029: [2, 3, 21, 12],
    2030: [2, 4, 3, 1],
  };

  if (lichunDates[year]) {
    const [month, day, hour, minute] = lichunDates[year];
    return new Date(year, month - 1, day, hour, minute);
  }

  return new Date(year, 1, 4, 6, 0);
}

export function getLunarZodiacYear(date: Date): number {
  const year = date.getFullYear();
  const lichun = getLichunDate(year);
  if (date < lichun) {
    return year - 1;
  }
  return year;
}

export function getZodiacByDate(date: Date): string {
  const lunarYear = getLunarZodiacYear(date);
  const baseYear = 2024;
  const baseZodiacIndex = ZODIACS.indexOf('龙');
  const offset = (lunarYear - baseYear) % 12;
  const zodiacIndex = (baseZodiacIndex + offset + 12) % 12;
  return ZODIACS[zodiacIndex];
}

export function getYearZodiacMapping(year: number): Record<string, number[]> {
  const lunarYear = getLunarZodiacYear(new Date(year, 6, 1));
  const yearZodiac = getZodiacByDate(new Date(lunarYear, 6, 1));
  const yearZodiacIndex = ZODIACS.indexOf(yearZodiac);
  const mapping: Record<string, number[]> = {};

  ZODIACS.forEach((zodiac, zodiacIndex) => {
    const offset = (yearZodiacIndex - zodiacIndex + 12) % 12;
    const numbers: number[] = [];
    const bases = [1, 13, 25, 37, 49];
    bases.forEach(base => {
      const num = base + offset;
      if (num <= 49) numbers.push(num);
    });
    mapping[zodiac] = numbers;
  });

  return mapping;
}

export function getZodiacByNumber(date: Date, number: number): string {
  const mapping = getYearZodiacMapping(date.getFullYear());
  for (const [zodiac, numbers] of Object.entries(mapping)) {
    if (numbers.includes(number)) {
      return zodiac;
    }
  }
  return '未知';
}

export function isZodiacNumber(date: Date, zodiac: string, number: number): boolean {
  const mapping = getYearZodiacMapping(date.getFullYear());
  const zodiacNumbers = mapping[zodiac];
  return zodiacNumbers?.includes(number) ?? false;
}
