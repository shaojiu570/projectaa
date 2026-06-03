// 农历生肖计算工具
// 基于立春分界点计算生肖年份

const ZODIACS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

/**
 * 获取指定年份的立春日期
 * 立春通常在2月4日左右，具体时间每年略有不同
 * 这里使用简化版本，实际应用可考虑更精确的天文算法
 */
function getLichunDate(year: number): Date {
  // 立春大致日期（简化版本）
  const lichunDates: Record<number, [number, number, number, number]> = {
    2020: [2, 4, 17, 3], // 2020-02-04 17:03
    2021: [2, 3, 22, 58], // 2021-02-03 22:58
    2022: [2, 4, 4, 50],  // 2022-02-04 04:50
    2023: [2, 4, 10, 42], // 2023-02-04 10:42
    2024: [2, 4, 16, 26], // 2024-02-04 16:26
    2025: [2, 3, 22, 10], // 2025-02-03 22:10
    2026: [2, 4, 3, 59],  // 2026-02-04 03:59
    2027: [2, 4, 9, 46],  // 2027-02-04 09:46
    2028: [2, 4, 15, 31], // 2028-02-04 15:31
    2029: [2, 3, 21, 12], // 2029-02-03 21:12
    2030: [2, 4, 3, 1],   // 2030-02-04 03:01
  };

  if (lichunDates[year]) {
    const [month, day, hour, minute] = lichunDates[year];
    return new Date(year, month - 1, day, hour, minute);
  }

  // 默认立春时间（2月4日）
  return new Date(year, 1, 4, 6, 0);
}

/**
 * 根据公历日期计算对应的农历生肖年份
 * @param date 公历日期
 * @returns 农历生肖年份（用于生肖计算）
 */
export function getLunarZodiacYear(date: Date): number {
  const year = date.getFullYear();
  const lichun = getLichunDate(year);
  
  // 如果在立春之前，属于上一年
  if (date < lichun) {
    return year - 1;
  }
  
  // 立春之后属于当年
  return year;
}

/**
 * 获取指定日期对应的生肖
 * @param date 公历日期
 * @returns 生肖名称
 */
export function getZodiacByDate(date: Date): string {
  const lunarYear = getLunarZodiacYear(date);
  
  // 2024年是龙年（基准年）
  const baseYear = 2024;
  const baseZodiacIndex = ZODIACS.indexOf('龙');
  
  const offset = (lunarYear - baseYear) % 12;
  const zodiacIndex = (baseZodiacIndex + offset + 12) % 12;
  
  return ZODIACS[zodiacIndex];
}

/**
 * 获取指定年份的所有生肖映射
 * @param year 公历年份
 * @returns 生肖号码映射
 */
export function getYearZodiacMapping(year: number): Record<string, number[]> {
  // 使用该年对应的农历生肖年份
  const lunarYear = getLunarZodiacYear(new Date(year, 6, 1)); // 使用年中日期
  const yearZodiac = getZodiacByDate(new Date(lunarYear, 6, 1));
  
  const yearZodiacIndex = ZODIACS.indexOf(yearZodiac);
  const mapping: Record<string, number[]> = {};
  
  ZODIACS.forEach((zodiac, zodiacIndex) => {
    // 计算偏移：当年生肖=0，前一生肖=1，以此类推
    const offset = (yearZodiacIndex - zodiacIndex + 12) % 12;
    
    // 生成号码：01+offset, 13+offset, 25+offset, 37+offset, 49+offset(如果≤49)
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

/**
 * 根据日期获取号码对应的生肖
 * @param date 开奖日期
 * @param number 号码
 * @returns 生肖名称
 */
export function getZodiacByNumber(date: Date, number: number): string {
  const mapping = getYearZodiacMapping(date.getFullYear());
  
  for (const [zodiac, numbers] of Object.entries(mapping)) {
    if (numbers.includes(number)) {
      return zodiac;
    }
  }
  
  return '未知';
}

/**
 * 验证日期是否属于指定生肖
 * @param date 开奖日期
 * @param zodiac 生肖名称
 * @param number 号码
 * @returns 是否匹配
 */
export function isZodiacNumber(date: Date, zodiac: string, number: number): boolean {
  const mapping = getYearZodiacMapping(date.getFullYear());
  const zodiacNumbers = mapping[zodiac];
  return zodiacNumbers?.includes(number) ?? false;
}
