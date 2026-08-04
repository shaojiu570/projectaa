/**
 * 六合彩预测系统 - 常量定义
 * 基于 release34 程序逻辑
 */

// 生肖列表
const ZODIACS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

// 波色映射（固定不变，仅用于号码展示）
const COLOR_NUMBERS = {
  '红波': [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46],
  '蓝波': [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48],
  '绿波': [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49]
};

// 立春日期表（精确到分钟）
const LICHUN_DATES = {
  2020: { month: 2, day: 4, hour: 17, minute: 3 },
  2021: { month: 2, day: 3, hour: 22, minute: 58 },
  2022: { month: 2, day: 4, hour: 4, minute: 50 },
  2023: { month: 2, day: 4, hour: 10, minute: 42 },
  2024: { month: 2, day: 4, hour: 16, minute: 26 },
  2025: { month: 2, day: 3, hour: 22, minute: 10 },
  2026: { month: 2, day: 4, hour: 3, minute: 59 },
  2027: { month: 2, day: 4, hour: 9, minute: 46 },
  2028: { month: 2, day: 4, hour: 15, minute: 31 },
  2029: { month: 2, day: 3, hour: 21, minute: 12 },
  2030: { month: 2, day: 4, hour: 3, minute: 1 },
};

/**
 * 获取立春日期
 */
function getLichunDate(year) {
  if (LICHUN_DATES[year]) {
    const { month, day, hour, minute } = LICHUN_DATES[year];
    return new Date(year, month - 1, day, hour, minute);
  }
  // 默认 2月4日
  return new Date(year, 1, 4, 6, 0);
}

/**
 * 获取农历生肖年份（基于立春）
 */
function getLunarZodiacYear(date) {
  const year = date.getFullYear();
  const lichun = getLichunDate(year);
  return date < lichun ? year - 1 : year;
}

/**
 * 获取某日期对应的生肖
 */
function getZodiacByDate(date) {
  const lunarYear = getLunarZodiacYear(date);
  // 2024年是龙年（基准年）
  const baseYear = 2024;
  const baseZodiacIndex = ZODIACS.indexOf('龙');
  const offset = (lunarYear - baseYear) % 12;
  const zodiacIndex = (baseZodiacIndex + offset + 12) % 12;
  return ZODIACS[zodiacIndex];
}

/**
 * 获取某年的生肖号码映射
 * 核心逻辑：当年生肖对应的号码是 1, 13, 25, 37, 49
 */
function getYearZodiacMapping(year) {
  // 使用年中日期确定该年的农历生肖
  const midYear = new Date(year, 6, 1);
  const lunarYear = getLunarZodiacYear(midYear);
  const yearZodiac = getZodiacByDate(new Date(lunarYear, 6, 1));
  
  const yearZodiacIndex = ZODIACS.indexOf(yearZodiac);
  const mapping = {};
  
  ZODIACS.forEach((zodiac, zodiacIndex) => {
    // 偏移量：当年生肖为0，前一生肖为1，以此类推
    const offset = (yearZodiacIndex - zodiacIndex + 12) % 12;
    // 生成号码
    const numbers = [];
    [1, 13, 25, 37, 49].forEach(base => {
      const num = base + offset;
      if (num <= 49) numbers.push(num);
    });
    mapping[zodiac] = numbers;
  });
  
  return mapping;
}

/**
 * 根据年份获取号码对应的生肖
 * year 应为农历生肖年份（立春后该公历年为当年，立春前为前一年）
 */
function getZodiacByNumber(num, year) {
  const mapping = getYearZodiacMapping(year);
  for (const [zodiac, numbers] of Object.entries(mapping)) {
    if (numbers.includes(num)) return zodiac;
  }
  return '未知';
}

/**
 * 按开奖记录动态映射生肖（立春/农历年）
 */
function getZodiacByRecord(record) {
  const date = new Date(record.date);
  const lunarYear = getLunarZodiacYear(date);
  return getZodiacByNumber(record.special, lunarYear);
}

/**
 * 按年份获取号码对应的五行（公历日历年）
 */
function getElementByYear(num, year) {
  const y = year || new Date().getFullYear();
  const yearData = YEAR_ELEMENTS[y];
  if (!yearData) return '未知';
  for (const [element, nums] of Object.entries(yearData)) {
    if (nums.includes(num)) return element;
  }
  return '未知';
}

/**
 * 五行映射（按年份）
 */
const YEAR_ELEMENTS = {
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

// 通用算法（统一模型库，可预测任意分类类型：号码/生肖/头/尾/五行/自定义）
const GENERIC_ALGO_NAMES = {
  hot: '热度', cold: '遗漏', cycle: '周期', markov: '马尔科夫', ma: '移动平均',
  condProb: '条件概率', bayes: '贝叶斯', apriori: 'Apriori',
  rf: '随机森林', xgboost: 'XGBoost', lstm: 'LSTM',
  genetic: '遗传算法', rl: '强化学习', bandit: '多臂老虎机',
};

function defaultAlgoSelections(weight = 0.1) {
  return Object.keys(GENERIC_ALGO_NAMES).map(id => ({ id, weight }));
}

/**
 * 无推送配置时的默认预测类型（动态预测内置类型，不含波色/单双/大小）
 */
function defaultTypes() {
  const all = Array.from({ length: 49 }, (_, i) => i + 1);
  const year = new Date().getFullYear();
  const elMap = YEAR_ELEMENTS[year] || YEAR_ELEMENTS[2026];
  const elems = ['金', '木', '水', '火', '土'];
  const zodMap = getYearZodiacMapping(getLunarZodiacYear(new Date()));
  return [
    {
      id: 'number', name: '号码类', enabled: true, resultCount: 30, topN: 30,
      selectedAlgorithms: defaultAlgoSelections(), categories: all.map(String),
      numberRanges: all.map(n => [n]), isBuiltin: true, autoWeight: false,
    },
    {
      id: 'tail', name: '尾数类', enabled: true, resultCount: 8, topN: 8,
      selectedAlgorithms: defaultAlgoSelections(),
      categories: Array.from({ length: 10 }, (_, i) => String(i)),
      numberRanges: Array.from({ length: 10 }, (_, i) => all.filter(n => n % 10 === i)),
      isBuiltin: true, autoWeight: false,
    },
    {
      id: 'head', name: '头数类', enabled: true, resultCount: 4, topN: 4,
      selectedAlgorithms: defaultAlgoSelections(),
      categories: ['0', '1', '2', '3', '4'],
      numberRanges: [0, 1, 2, 3, 4].map(d => all.filter(n => Math.floor(n / 10) === d)),
      isBuiltin: true, autoWeight: false,
    },
    {
      id: 'element', name: '五行类', enabled: true, resultCount: 4, topN: 4,
      selectedAlgorithms: defaultAlgoSelections(), categories: elems,
      numberRanges: elems.map(e => elMap[e] || []), isBuiltin: true, autoWeight: false,
    },
    {
      id: 'zodiac', name: '生肖类', enabled: true, resultCount: 9, topN: 9,
      selectedAlgorithms: defaultAlgoSelections(), categories: ZODIACS,
      numberRanges: ZODIACS.map(z => zodMap[z] || []),
      isBuiltin: true, autoWeight: false,
    },
  ];
}

/**
 * 根据类型定义构建 开奖记录→类别 映射函数
 * 内置生肖/五行按记录日期动态映射（生肖按立春/农历年，五行按公历日历年），
 * 其余类型（号码/头/尾/自定义）由 categories + numberRanges 驱动。
 */
function buildTypeMapper(type) {
  if (type.isBuiltin && type.id === 'zodiac') return (d) => getZodiacByRecord(d);
  if (type.isBuiltin && type.id === 'element') return (d) => getElementByYear(d.special, new Date(d.date).getFullYear());
  const cats = type.categories || [];
  const ranges = type.numberRanges || [];
  return (d) => {
    for (let i = 0; i < cats.length; i++) {
      if ((ranges[i] || []).includes(d.special)) return cats[i];
    }
    return cats[0] || '';
  };
}

// ==================== 外部推送配置覆盖 ====================
// 由前端「动态预测 → 一键推送」生成的 config.json，定义脚本使用的全部预测类型。
// 结构: { finalCount, updatedAt, types: [{ id,name,enabled,resultCount,topN,
//   selectedAlgorithms:[{id,weight}], categories, numberRanges, isBuiltin, autoWeight }] }
let PUSHED_CONFIG = null;
try {
  PUSHED_CONFIG = require('./config.json');
} catch (e) {
  PUSHED_CONFIG = null;
}

const EFFECTIVE_TYPES = (PUSHED_CONFIG && Array.isArray(PUSHED_CONFIG.types) && PUSHED_CONFIG.types.length > 0)
  ? PUSHED_CONFIG.types
    .filter(t => t && t.categories && Array.isArray(t.categories))
    .map(t => ({
      id: t.id || 'type_' + Math.random().toString(36).slice(2),
      name: t.name || t.id || '未命名',
      enabled: t.enabled !== false,
      resultCount: Math.max(1, t.resultCount || 5),
      topN: Math.max(1, t.topN || t.resultCount || 5),
      selectedAlgorithms: (t.selectedAlgorithms || []).filter(sa => sa && sa.id),
      categories: t.categories,
      numberRanges: t.numberRanges || t.categories.map(() => []),
      isBuiltin: !!t.isBuiltin,
      autoWeight: !!t.autoWeight,
    }))
  : defaultTypes();

const FINAL_COUNT = (PUSHED_CONFIG && PUSHED_CONFIG.finalCount) || 10;

module.exports = {
  ZODIACS,
  COLOR_NUMBERS,
  YEAR_ELEMENTS,
  LICHUN_DATES,
  GENERIC_ALGO_NAMES,
  PUSHED_CONFIG,
  EFFECTIVE_TYPES,
  FINAL_COUNT,
  buildTypeMapper,
  defaultTypes,
  getLichunDate,
  getLunarZodiacYear,
  getZodiacByDate,
  getYearZodiacMapping,
  getZodiacByNumber,
  getZodiacByRecord,
  getElementByYear,
};
