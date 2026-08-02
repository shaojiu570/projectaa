/**
 * 六合彩预测系统 - 常量定义
 * 基于 release34 程序逻辑
 */

// 生肖列表
const ZODIACS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

// 波色映射（固定不变）
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
 */
function getZodiacByNumber(num, year) {
  const mapping = getYearZodiacMapping(year);
  for (const [zodiac, numbers] of Object.entries(mapping)) {
    if (numbers.includes(num)) return zodiac;
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

// 通用算法（统一模型库，可预测任意分类类型：号码/生肖/头/尾/五行）
const GENERIC_ALGO_NAMES = {
  hot: '热度', cold: '遗漏', cycle: '周期', markov: '马尔科夫', ma: '移动平均',
  condProb: '条件概率', bayes: '贝叶斯', apriori: 'Apriori',
  rf: '随机森林', xgboost: 'XGBoost', lstm: 'LSTM',
  genetic: '遗传算法', rl: '强化学习', bandit: '多臂老虎机',
};

function defaultGenericModels(weight = 0.1) {
  return Object.keys(GENERIC_ALGO_NAMES).map(id => ({ id, name: GENERIC_ALGO_NAMES[id], weight }));
}

// 默认模型配置（统一模型库 = 全部通用算法；可由智能预测「推送配置」覆盖）
const DEFAULT_NUMBER_MODELS = defaultGenericModels();
const DEFAULT_ZODIAC_MODELS = defaultGenericModels();

const COLOR_MODELS = ['color_freq', 'color_trend', 'color_pattern'];
const SIZE_MODELS = ['size_freq', 'size_alternate'];
const PARITY_MODELS = ['parity_freq', 'parity_trend'];
const DEFAULT_HEAD_MODELS = defaultGenericModels();
const HEAD_CATEGORIES = ['0头', '1头', '2头', '3头', '4头'];
const DEFAULT_TAIL_MODELS = defaultGenericModels();
const TAIL_CATEGORIES = ['0尾', '1尾', '2尾', '3尾', '4尾', '5尾', '6尾', '7尾', '8尾', '9尾'];
const DEFAULT_ELEMENT_MODELS = defaultGenericModels();
const ELEMENT_CATEGORIES = ['金', '木', '水', '火', '土'];

// ==================== 外部推送配置覆盖 ====================
// 由智能预测「推送配置」生成的 config.json，替换各类型使用的模型。
// 结构: { number:[{id,weight}], zodiac:[{id,weight}], head:[{id,weight}], tail:[{id,weight}], element:[{id,weight}] }
let PUSHED_CONFIG = null;
try {
  PUSHED_CONFIG = require('./config.json');
} catch (e) {
  PUSHED_CONFIG = null;
}

function normalizeWeighted(id, weight) {
  return { id, weight };
}

// 号码/生肖：若推送配置存在，用推送的模型列表替换（保留默认名称）
let EFFECTIVE_NUMBER_MODELS = DEFAULT_NUMBER_MODELS;
let EFFECTIVE_ZODIAC_MODELS = DEFAULT_ZODIAC_MODELS;
if (PUSHED_CONFIG) {
  if (Array.isArray(PUSHED_CONFIG.number) && PUSHED_CONFIG.number.length > 0) {
    EFFECTIVE_NUMBER_MODELS = PUSHED_CONFIG.number.map(m => {
      const def = DEFAULT_NUMBER_MODELS.find(d => d.id === m.id);
      return { id: m.id, name: (def ? def.name : GENERIC_ALGO_NAMES[m.id]) || m.id, weight: m.weight };
    });
  }
  if (Array.isArray(PUSHED_CONFIG.zodiac) && PUSHED_CONFIG.zodiac.length > 0) {
    EFFECTIVE_ZODIAC_MODELS = PUSHED_CONFIG.zodiac.map(m => {
      const def = DEFAULT_ZODIAC_MODELS.find(d => d.id === m.id);
      return { id: m.id, name: (def ? def.name : GENERIC_ALGO_NAMES[m.id]) || m.id, weight: m.weight };
    });
  }
}

// 头数/尾数/五行：若推送配置存在，转为带权重的对象数组；否则保持字符串 ID 数组
let HEAD_MODELS = DEFAULT_HEAD_MODELS;
let TAIL_MODELS = DEFAULT_TAIL_MODELS;
let ELEMENT_MODELS = DEFAULT_ELEMENT_MODELS;
if (PUSHED_CONFIG) {
  if (Array.isArray(PUSHED_CONFIG.head) && PUSHED_CONFIG.head.length > 0) {
    HEAD_MODELS = PUSHED_CONFIG.head.map(m => normalizeWeighted(m.id, m.weight));
  }
  if (Array.isArray(PUSHED_CONFIG.tail) && PUSHED_CONFIG.tail.length > 0) {
    TAIL_MODELS = PUSHED_CONFIG.tail.map(m => normalizeWeighted(m.id, m.weight));
  }
  if (Array.isArray(PUSHED_CONFIG.element) && PUSHED_CONFIG.element.length > 0) {
    ELEMENT_MODELS = PUSHED_CONFIG.element.map(m => normalizeWeighted(m.id, m.weight));
  }
}

module.exports = {
  ZODIACS,
  COLOR_NUMBERS,
  YEAR_ELEMENTS,
  LICHUN_DATES,
  DEFAULT_NUMBER_MODELS,
  DEFAULT_ZODIAC_MODELS,
  EFFECTIVE_NUMBER_MODELS,
  EFFECTIVE_ZODIAC_MODELS,
  COLOR_MODELS,
  SIZE_MODELS,
  PARITY_MODELS,
  HEAD_MODELS,
  TAIL_MODELS,
  ELEMENT_MODELS,
  HEAD_CATEGORIES,
  TAIL_CATEGORIES,
  ELEMENT_CATEGORIES,
  GENERIC_ALGO_NAMES,
  PUSHED_CONFIG,
  getLichunDate,
  getLunarZodiacYear,
  getZodiacByDate,
  getYearZodiacMapping,
  getZodiacByNumber,
};
