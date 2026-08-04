/**
 * 六合彩预测系统 - 工具函数
 * 基于 release34 程序逻辑
 */

const { COLOR_NUMBERS, YEAR_ELEMENTS, getYearZodiacMapping, getLunarZodiacYear } = require('./constants.cjs');

/**
 * 根据号码和年份获取生肖
 * year 应为农历生肖年份（立春后该公历年为当年，立春前为前一年）
 */
function getZodiac(num, year) {
  year = year || new Date().getFullYear();
  const mapping = getYearZodiacMapping(year);
  for (const [zodiac, numbers] of Object.entries(mapping)) {
    if (numbers.includes(num)) return zodiac;
  }
  return '未知';
}

/**
 * 按开奖记录动态映射生肖（立春/农历年）
 */
function getZodiacOfRecord(record) {
  return getZodiac(record.special, getLunarZodiacYear(new Date(record.date)));
}

/**
 * 按开奖记录动态映射五行（日历年）
 */
function getElementOfRecord(record) {
  return getElement(record.special, new Date(record.date).getFullYear());
}

/**
 * 根据号码获取波色
 */
function getColor(num) {
  for (const [c, nums] of Object.entries(COLOR_NUMBERS)) {
    if (nums.includes(num)) return c;
  }
  return '未知';
}

/**
 * 根据号码获取大小（24及以下为小，25及以上为大）
 */
function getSize(num) {
  return num >= 25 ? '大' : '小';
}

/**
 * 根据号码获取奇偶
 */
function getParity(num) {
  return num % 2 === 1 ? '单' : '双';
}

/**
 * 根据号码和年份获取五行
 */
function getElement(num, year) {
  year = year || new Date().getFullYear();
  const yearData = YEAR_ELEMENTS[year];
  if (!yearData) return '未知';
  for (const [e, nums] of Object.entries(yearData)) {
    if (nums.includes(num)) return e;
  }
  return '未知';
}

/**
 * 带种子的随机数生成器
 */
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * 概率数组归一化
 */
function normalize(arr) {
  const sum = arr.reduce((a, b) => a + b, 0);
  return sum > 0 ? arr.map(v => v / sum) : arr.map(() => 1 / arr.length);
}

/**
 * 延迟函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 格式化日期
 */
function formatDate(date) {
  return new Date(date).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

module.exports = {
  getZodiac,
  getZodiacOfRecord,
  getElementOfRecord,
  getColor,
  getSize,
  getParity,
  getElement,
  seededRandom,
  normalize,
  sleep,
  formatDate
};
