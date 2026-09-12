import { DrawRecord } from '../../data/types';
import { seededRandom } from '../../utils/helpers';
import { getElement, YEAR_ELEMENTS } from '../../constants/element';
import { getTailNumber } from '../../constants/size';
import { getLunarZodiacYear, getYearZodiacMapping, getZodiacByNumber } from '../../utils/lunarCalendar';
import { AlgorithmConfig, PredictionTypeConfig, DynamicPredictionRecord } from './types';

export interface BuiltinTypeMeta {
  id: string; name: string;
  categories: string[];
  numberRanges: number[][];
  resultCountMax: number;
  resultCountPresets: number[];
}

export const BUILTIN_TYPES: BuiltinTypeMeta[] = [
  {
    id: 'number', name: '号码类',
    categories: Array.from({ length: 49 }, (_, i) => String(i + 1)),
    numberRanges: Array.from({ length: 49 }, (_, i) => [i + 1]),
    resultCountMax: 49, resultCountPresets: [5, 10, 20, 30, 49],
  },
  {
    id: 'tail', name: '尾数类',
    categories: Array.from({ length: 10 }, (_, i) => String(i)),
    numberRanges: Array.from({ length: 10 }, (_, i) =>
      Array.from({ length: 49 }, (_, j) => j + 1).filter(n => getTailNumber(n) === i)),
    resultCountMax: 10, resultCountPresets: [1, 2, 3, 5, 10],
  },
  {
    id: 'head', name: '头数类',
    categories: ['0', '1', '2', '3', '4'],
    numberRanges: [0, 1, 2, 3, 4].map(d =>
      Array.from({ length: 49 }, (_, i) => i + 1).filter(n => Math.floor(n / 10) === d)),
    resultCountMax: 5, resultCountPresets: [1, 2, 3, 5],
  },
  {
    id: 'element', name: '五行类',
    categories: ['金', '木', '水', '火', '土'],
    numberRanges: ['金', '木', '水', '火', '土'].map(e =>
      (YEAR_ELEMENTS[new Date().getFullYear()] || YEAR_ELEMENTS[2026])[e] || []),
    resultCountMax: 5, resultCountPresets: [1, 2, 3, 5],
  },
  {
    id: 'zodiac', name: '生肖类',
    categories: ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'],
    numberRanges: (() => {
      const map = getYearZodiacMapping(getLunarZodiacYear(new Date()));
      return ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'].map(z => map[z] || []);
    })(),
    resultCountMax: 12, resultCountPresets: [1, 2, 3, 5, 12],
  },
];

function parseRecordDate(d: DrawRecord): Date {
  const date = new Date(d.date);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function recordYear(d: DrawRecord): number {
  return parseRecordDate(d).getFullYear();
}

/** 按开奖日期动态映射：生肖（立春/农历年） */
export function zodiacOfRecord(d: DrawRecord): string {
  return getZodiacByNumber(parseRecordDate(d), d.special);
}

/** 按开奖日期动态映射：五行（日历年） */
export function elementOfRecord(d: DrawRecord): string {
  return getElement(d.special, recordYear(d));
}

/** 估算下期开奖日期：最后一期 +1 天 */
function estimateTargetDate(data: DrawRecord[]): Date {
  if (data.length === 0) return new Date();
  const d = new Date(parseRecordDate(data[data.length - 1]));
  d.setDate(d.getDate() + 1);
  return d;
}

/** 预测目标期号码映射：内置生肖/五行按目标日期动态生成，自定义类型用存储的 numberRanges */
function getPredictionRanges(type: PredictionTypeConfig, date: Date): number[][] {
  if (type.isBuiltin && type.id === 'zodiac') {
    const map = getYearZodiacMapping(getLunarZodiacYear(date));
    return type.categories.map(c => map[c] || []);
  }
  if (type.isBuiltin && type.id === 'element') {
    const map = YEAR_ELEMENTS[date.getFullYear()] || YEAR_ELEMENTS[2026];
    return type.categories.map(c => map[c] || []);
  }
  return type.numberRanges || [];
}

/**
 * 命中判定 TopN：跟随各类型「推荐数量」设置（resultCount），
 * 与前端展示、自动发送脚本的判定窗口保持一致。
 */
export function computeTopN(type: PredictionTypeConfig): number {
  const maxTopN = Math.max(1, type.categories.length - 1);
  return Math.max(1, Math.min(type.resultCount || 1, maxTopN));
}

type AlgoFactory = (cats: string[], getCat: (d: DrawRecord) => string) =>
  (data: DrawRecord[], seed: number) => Record<string, number>;

/**
 * 全量历史 + 指数衰减计数：覆盖所有开奖记录，但越近的期数权重越高。
 * 半衰期约 34 期（decay=0.98），既充分利用全部历史，又不被远古数据稀释。
 */
function weightedCounts(cats: string[], data: DrawRecord[], getCat: (d: DrawRecord) => string, decay = 0.98): Record<string, number> {
  const counts: Record<string, number> = {};
  cats.forEach(c => counts[c] = 0);
  const n = data.length;
  for (let i = 0; i < n; i++) {
    const w = Math.pow(decay, n - 1 - i);
    const c = getCat(data[i]);
    counts[c] = (counts[c] || 0) + w;
  }
  return counts;
}

const hot: AlgoFactory = (cats, getCat) => (data, seed) => {
  const rng = seededRandom(seed + 1);
  const p: Record<string, number> = {}; cats.forEach(c => p[c] = 0);
  const counts = weightedCounts(cats, data, getCat);
  const mf = Math.max(...Object.values(counts), 1);
  cats.forEach(c => p[c] = (counts[c] / mf) * 0.9 + rng() * 0.1);
  const s = Object.values(p).reduce((a, b) => a + b, 0) || 1; cats.forEach(c => p[c] /= s); return p;
};

const cold: AlgoFactory = (cats, getCat) => (data, seed) => {
  const rng = seededRandom(seed + 2);
  const p: Record<string, number> = {}; cats.forEach(c => p[c] = 0);
  const last: Record<string, number> = {}; cats.forEach(c => last[c] = -1);
  for (let i = data.length - 1; i >= 0; i--) {
    const c = getCat(data[i]);
    if (last[c] === -1) last[c] = i;
    if (Object.values(last).every(v => v !== -1)) break;
  }
  const n = data.length;
  const mg = Math.max(...cats.map(c => last[c] === -1 ? n : n - last[c]), 1);
  cats.forEach(c => { const g = last[c] === -1 ? n : n - last[c]; p[c] = (g / mg) * 0.6 + rng() * 0.15; });
  const s = Object.values(p).reduce((a, b) => a + b, 0) || 1; cats.forEach(c => p[c] /= s); return p;
};

const cycle: AlgoFactory = (cats, getCat) => (data, seed) => {
  const rng = seededRandom(seed + 3);
  const p: Record<string, number> = {}; cats.forEach(c => p[c] = 0);
  const n = data.length;
  cats.forEach(c => {
    const pos: number[] = [];
    for (let i = n - 1; i >= 0; i--) {
      if (getCat(data[i]) === c) { pos.push(i); if (pos.length >= 8) break; }
    }
    pos.reverse();
    if (pos.length >= 2) {
      const gaps: number[] = []; for (let i = 1; i < pos.length; i++) gaps.push(pos[i] - pos[i - 1]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const sl = n - 1 - pos[pos.length - 1];
      if (Math.abs(sl - avg) <= 3) p[c] += 0.5; else if (sl > avg) p[c] += 0.3;
    } else if (pos.length === 1) { p[c] += 0.2; }
    p[c] += rng() * 0.05;
  });
  const s = Object.values(p).reduce((a, b) => a + b, 0) || 1; cats.forEach(c => p[c] /= s); return p;
};

const markov: AlgoFactory = (cats, getCat) => (data, seed) => {
  if (data.length < 2) { const p: Record<string, number> = {}; cats.forEach(c => p[c] = 1 / cats.length); return p; }
  const rng = seededRandom(seed + 4);
  const p: Record<string, number> = {}; cats.forEach(c => p[c] = 0);
  const trans: Record<string, Record<string, number>> = {};
  cats.forEach(c => { trans[c] = {}; cats.forEach(c2 => trans[c][c2] = 0); });
  for (let i = 1; i < data.length; i++) { const a = getCat(data[i - 1]); const b = getCat(data[i]); if (trans[a]) trans[a][b] = (trans[a][b] || 0) + 1; }
  const last = getCat(data[data.length - 1]);
  if (trans[last]) {
    const total = Object.values(trans[last]).reduce((a, b) => a + b, 0);
    if (total > 0) cats.forEach(c => p[c] = (trans[last][c] || 0) / total * 0.8 + rng() * 0.2);
    else cats.forEach(c => p[c] = 1 / cats.length);
  } else cats.forEach(c => p[c] = 1 / cats.length);
  const s = Object.values(p).reduce((a, b) => a + b, 0) || 1; cats.forEach(c => p[c] /= s); return p;
};

const ma: AlgoFactory = (cats, getCat) => (data, seed) => {
  const rng = seededRandom(seed + 5);
  const p: Record<string, number> = {}; cats.forEach(c => p[c] = 0);
  const recent = data.slice(-30);
  const weights = [0.5, 0.3, 0.2];
  recent.forEach((d, i) => {
    const ci = recent.length - 1 - i;
    if (ci < weights.length) { const c = getCat(d); p[c] = (p[c] || 0) + weights[ci]; }
  });
  cats.forEach(c => p[c] = (p[c] || 0) + rng() * 0.1);
  const s = Object.values(p).reduce((a, b) => a + b, 0) || 1; cats.forEach(c => p[c] /= s); return p;
};

const condProb: AlgoFactory = (cats, getCat) => (data, seed) => {
  const rng = seededRandom(seed + 6);
  const p: Record<string, number> = {};
  const counts = weightedCounts(cats, data, getCat);
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  cats.forEach(c => p[c] = ((counts[c] || 0) / total) * 0.7 + rng() * 0.3);
  const s = Object.values(p).reduce((a, b) => a + b, 0) || 1; cats.forEach(c => p[c] /= s); return p;
};

const bayes: AlgoFactory = (cats, getCat) => (data, seed) => {
  const rng = seededRandom(seed + 7);
  const p: Record<string, number> = {};
  const prior = weightedCounts(cats, data, getCat);
  const pt = Object.values(prior).reduce((a, b) => a + b, 0) || 1;
  const last = data.length > 1 ? getCat(data[data.length - 2]) : '';
  if (last) {
    const cond: Record<string, number> = {}; cats.forEach(c => cond[c] = 0);
    for (let i = 1; i < data.length; i++) {
      if (getCat(data[i - 1]) === last) { const c = getCat(data[i]); cond[c] = (cond[c] || 0) + 1; }
    }
    const ct = Object.values(cond).reduce((a, b) => a + b, 0) || 1;
    cats.forEach(c => p[c] = ((cond[c] || 0) / ct) * 0.6 + ((prior[c] || 0) / pt) * 0.3 + rng() * 0.1);
  } else {
    cats.forEach(c => p[c] = ((prior[c] || 0) / pt) * 0.7 + rng() * 0.3);
  }
  const s = Object.values(p).reduce((a, b) => a + b, 0) || 1; cats.forEach(c => p[c] /= s); return p;
};

const apriori: AlgoFactory = (cats, getCat) => (data, seed) => {
  const rng = seededRandom(seed + 8);
  const p: Record<string, number> = {}; cats.forEach(c => p[c] = 0);
  const pairs: Record<string, Record<string, number>> = {};
  cats.forEach(c => { pairs[c] = {}; cats.forEach(c2 => pairs[c][c2] = 0); });
  for (let i = 2; i < data.length; i++) {
    const a = getCat(data[i - 2]); const b = getCat(data[i - 1]);
    if (pairs[a]) pairs[a][b] = (pairs[a][b] || 0) + 1;
  }
  if (data.length >= 2) {
    const lastTwo = getCat(data[data.length - 2]);
    if (pairs[lastTwo]) {
      const total = Object.values(pairs[lastTwo]).reduce((a, b) => a + b, 0) || 1;
      cats.forEach(c => p[c] = ((pairs[lastTwo][c] || 0) / total) * 0.7 + rng() * 0.3);
    }
  }
  if (Object.values(p).every(v => v === 0)) cats.forEach(c => p[c] = 1 / cats.length);
  const s = Object.values(p).reduce((a, b) => a + b, 0) || 1; cats.forEach(c => p[c] /= s); return p;
};

const rf: AlgoFactory = (cats, getCat) => (data, seed) => {
  const rng = seededRandom(seed + 9);
  const p: Record<string, number> = {}; cats.forEach(c => p[c] = 0);
  const recent = data.slice(-300);
  for (let tree = 0; tree < 10; tree++) {
    const tSeed = seededRandom(seed + 100 + tree);
    const sample = [...Array(30)].map(() => recent[Math.floor(tSeed() * recent.length)]).filter(Boolean);
    const votes: Record<string, number> = {}; cats.forEach(c => votes[c] = 0);
    sample.forEach(d => { const c = getCat(d); votes[c] = (votes[c] || 0) + 1; });
    cats.forEach(c => p[c] += (votes[c] || 0) / sample.length);
  }
  cats.forEach(c => p[c] = p[c] / 10 * 0.7 + rng() * 0.3);
  const s = Object.values(p).reduce((a, b) => a + b, 0) || 1; cats.forEach(c => p[c] /= s); return p;
};

const xgboost: AlgoFactory = (cats, getCat) => (data, seed) => {
  const rng = seededRandom(seed + 10);
  const p: Record<string, number> = {}; cats.forEach(c => p[c] = 0);
  const recent = data.slice(-300);
  for (let boost = 0; boost < 5; boost++) {
    const bSeed = seededRandom(seed + 200 + boost);
    const residuals: Record<string, number> = {}; cats.forEach(c => residuals[c] = 0);
    const sample = [...Array(20)].map(() => recent[Math.floor(bSeed() * recent.length)]).filter(Boolean);
    sample.forEach(d => { const c = getCat(d); residuals[c] = (residuals[c] || 0) + 1; });
    cats.forEach(c => p[c] += ((residuals[c] || 0) / sample.length) * (0.5 + bSeed() * 0.3));
  }
  cats.forEach(c => p[c] = p[c] / 5 + rng() * 0.1);
  const s = Object.values(p).reduce((a, b) => a + b, 0) || 1; cats.forEach(c => p[c] /= s); return p;
};

const lstm: AlgoFactory = (cats, getCat) => (data, seed) => {
  const rng = seededRandom(seed + 11);
  const p: Record<string, number> = {}; cats.forEach(c => p[c] = 0);
  const recent = data.slice(-60);
  const sequence: Record<string, number>[] = [];
  for (let i = 0; i < recent.length; i++) {
    const step: Record<string, number> = {}; cats.forEach(c => step[c] = 0);
    const c = getCat(recent[i]); step[c] = 1;
    sequence.push(step);
  }
  const lookback = 10;
  if (sequence.length > lookback) {
    const input = sequence.slice(-lookback);
    const weights = [0.3, 0.2, 0.15, 0.1, 0.08, 0.06, 0.04, 0.03, 0.02, 0.02];
    cats.forEach(c => {
      let sum = 0; input.forEach((s, idx) => { if (idx < weights.length) sum += (s[c] || 0) * weights[idx]; });
      p[c] = sum * 0.6 + rng() * 0.4;
    });
  } else cats.forEach(c => p[c] = 1 / cats.length);
  const s = Object.values(p).reduce((a, b) => a + b, 0) || 1; cats.forEach(c => p[c] /= s); return p;
};

const genetic: AlgoFactory = (cats, getCat) => (data, seed) => {
  const rng = seededRandom(seed + 12);
  const p: Record<string, number> = {}; cats.forEach(c => p[c] = 0);
  const recent = data.slice(-200);
  const popSize = 10;
  const pop: Record<string, number>[] = [];
  for (let i = 0; i < popSize; i++) {
    const gSeed = seededRandom(seed + 300 + i);
    const ind: Record<string, number> = {}; cats.forEach(c => ind[c] = gSeed());
    const s = Object.values(ind).reduce((a, b) => a + b, 0) || 1; cats.forEach(c => ind[c] /= s);
    pop.push(ind);
  }
  for (let gen = 0; gen < 5; gen++) {
    const fitness = pop.map(ind => {
      let score = 0; recent.forEach(d => { const c = getCat(d); score += ind[c] || 0; });
      return score / recent.length;
    });
    const bestIdx = fitness.indexOf(Math.max(...fitness));
    const best = pop[bestIdx];
    cats.forEach(c => p[c] += best[c] || 0);
    for (let i = 0; i < popSize; i++) {
      const mSeed = seededRandom(seed + 400 + gen * 10 + i);
      cats.forEach(c => pop[i][c] = (best[c] || 0) * 0.8 + mSeed() * 0.2);
      const s = Object.values(pop[i]).reduce((a, b) => a + b, 0) || 1; cats.forEach(c => pop[i][c] /= s);
    }
  }
  cats.forEach(c => p[c] = p[c] / 5 + rng() * 0.05);
  const s = Object.values(p).reduce((a, b) => a + b, 0) || 1; cats.forEach(c => p[c] /= s); return p;
};

const rl: AlgoFactory = (cats, getCat) => (data, seed) => {
  const rng = seededRandom(seed + 13);
  const p: Record<string, number> = {}; cats.forEach(c => p[c] = 0);
  const recent = data.slice(-200);
  const qValues: Record<string, number> = {}; cats.forEach(c => qValues[c] = rng());
  const lr = 0.1; const discount = 0.9;
  for (let i = 1; i < recent.length; i++) {
    const state = getCat(recent[i - 1]);
    const reward = 1;
    if (qValues[state] != null) qValues[state] = qValues[state] + lr * (reward + discount * Math.max(...cats.map(c => qValues[c])) - qValues[state]);
  }
  const expQ = cats.map(c => Math.exp(qValues[c] || 0));
  const sumExp = expQ.reduce((a, b) => a + b, 0) || 1;
  cats.forEach((c, i) => p[c] = (expQ[i] / sumExp) * 0.7 + rng() * 0.3);
  const s = Object.values(p).reduce((a, b) => a + b, 0) || 1; cats.forEach(c => p[c] /= s); return p;
};

const bandit: AlgoFactory = (cats, getCat) => (data, seed) => {
  const rng = seededRandom(seed + 14);
  const p: Record<string, number> = {}; cats.forEach(c => p[c] = 0);
  const counts: Record<string, number> = {}; cats.forEach(c => counts[c] = 0);
  const rewards: Record<string, number> = {}; cats.forEach(c => rewards[c] = 0);
  const n = data.length;
  for (let i = 0; i < n; i++) {
    const w = Math.pow(0.98, n - 1 - i);
    const c = getCat(data[i]); counts[c] = (counts[c] || 0) + w;
    if (i > 0) { const prev = getCat(data[i - 1]); if (c === prev) rewards[prev] = (rewards[prev] || 0) + w; }
  }
  cats.forEach(c => {
    const avg = counts[c] ? ((rewards[c] || 0) / counts[c]) : 0;
    const bonus = Math.sqrt(2 * Math.log(n) / (counts[c] || 1));
    p[c] = avg + bonus + rng() * 0.1;
  });
  const s = Object.values(p).reduce((a, b) => a + b, 0) || 1; cats.forEach(c => p[c] /= s); return p;
};

export const ALGO_FACTORIES: Record<string, AlgoFactory> = {
  hot, cold, cycle, markov, ma, condProb, bayes, apriori,
  rf, xgboost, lstm, genetic, rl, bandit,
};

export const PREDEFINED_ALGOS: AlgorithmConfig[] = [
  { id: 'hot', name: '热度', enabled: true, weight: 1 },
  { id: 'cold', name: '遗漏', enabled: true, weight: 1 },
  { id: 'cycle', name: '周期', enabled: true, weight: 1 },
  { id: 'markov', name: '马尔科夫', enabled: true, weight: 1 },
  { id: 'ma', name: '移动平均', enabled: true, weight: 1 },
  { id: 'condProb', name: '条件概率', enabled: true, weight: 1 },
  { id: 'bayes', name: '贝叶斯', enabled: true, weight: 1 },
  { id: 'apriori', name: 'Apriori', enabled: true, weight: 1 },
  { id: 'rf', name: '随机森林', enabled: true, weight: 1 },
  { id: 'xgboost', name: 'XGBoost', enabled: true, weight: 1 },
  { id: 'lstm', name: 'LSTM', enabled: true, weight: 1 },
  { id: 'genetic', name: '遗传算法', enabled: true, weight: 1 },
  { id: 'rl', name: '强化学习', enabled: true, weight: 1 },
  { id: 'bandit', name: '多臂老虎机', enabled: true, weight: 1 },
];

export function getTypeMapper(type: PredictionTypeConfig): (d: DrawRecord) => string {
  if (type.isBuiltin && type.id === 'number') return d => String(d.special);
  if (type.isBuiltin && type.id === 'tail') return d => String(getTailNumber(d.special));
  if (type.isBuiltin && type.id === 'head') return d => String(Math.floor(d.special / 10));
  if (type.isBuiltin && type.id === 'element') return elementOfRecord;
  if (type.isBuiltin && type.id === 'zodiac') return zodiacOfRecord;
  return d => {
    for (let i = 0; i < type.categories.length; i++) {
      if ((type.numberRanges[i] || []).includes(d.special)) return type.categories[i];
    }
    return type.categories[0] || '';
  };
}

function getAlgoWeight(type: PredictionTypeConfig, algoId: string, _globalAlgos: AlgorithmConfig[]): number {
  const ta = type.selectedAlgorithms.find(x => x.id === algoId);
  const base = ta?.weight ?? 0.1;
  if (ta?.hitRate != null && ta.hitRate > 0) return base * (1 + Math.min(ta.hitRate * 0.5, 0.2));
  return base;
}

export interface AlgoEvalStats {
  algoId: string;
  hitRate: number;
  hitCount: number;
  totalCount: number;
  avgRank: number;
}

/** 样本外评估：对每个类型/算法，逐期滚动（训练只用到评估期之前的数据）统计命中率与平均名次 */
export function evaluateAlgorithmsSampleOut(
  data: DrawRecord[],
  globalAlgos: AlgorithmConfig[],
  enabledTypes: PredictionTypeConfig[],
  window = 30,
): Record<string, Record<string, AlgoEvalStats>> {
  const result: Record<string, Record<string, AlgoEvalStats>> = {};
  if (data.length < 10) return result;

  enabledTypes.forEach(type => {
    const getCat = getTypeMapper(type);
    const enabledAlgos = type.selectedAlgorithms.filter(ta => globalAlgos.some(ga => ga.id === ta.id && ga.enabled));
    if (enabledAlgos.length === 0) return;

    const acc: Record<string, { hits: number; count: number; rankSum: number }> = {};
    enabledAlgos.forEach(ta => acc[ta.id] = { hits: 0, count: 0, rankSum: 0 });

    const start = Math.max(0, data.length - window);
    for (let pi = start; pi < data.length; pi++) {
      const trainData = data.slice(0, pi);
      if (trainData.length < 5) continue;
      const testRecord = data[pi];
      const lastIssue = trainData[trainData.length - 1]?.issue || '0';
      const seed = lastIssue.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0) & 0x7fffffff;
      const actual = getCat(testRecord);

      enabledAlgos.forEach((ta, idx) => {
        const factory = ALGO_FACTORIES[ta.id];
        if (!factory) return;
        const probs = factory(type.categories, getCat)(trainData, seed + idx * 1000);
        const sorted = type.categories.map(c => ({ c, p: probs[c] || 0 })).sort((a, b) => b.p - a.p);
        const rank = sorted.findIndex(x => x.c === actual) + 1;
        acc[ta.id].count++;
        acc[ta.id].rankSum += rank > 0 ? rank : type.categories.length;
        if (rank === 1) acc[ta.id].hits++;
      });
    }

    result[type.id] = Object.fromEntries(
      enabledAlgos.map(ta => {
        const s = acc[ta.id];
        return [ta.id, {
          algoId: ta.id,
          hitRate: s.count > 0 ? s.hits / s.count : 0,
          hitCount: s.hits,
          totalCount: s.count,
          avgRank: s.count > 0 ? s.rankSum / s.count : 99,
        }];
      }),
    );
  });
  return result;
}

export function runPrediction(
  data: DrawRecord[],
  seed: number,
  globalAlgos: AlgorithmConfig[],
  enabledTypes: PredictionTypeConfig[],
): {
  typeResults: { typeId: string; typeName: string; categories: { category: string; probability: number }[] }[];
  typeHits?: { typeId: string; actualCategory: string; algorithmResults: { algoId: string; rank: number }[] }[];
  finalNumbers: { number: number; probability: number }[];
} {
  const typeResultsList: { typeId: string; typeName: string; categories: { category: string; probability: number }[] }[] = [];
  const typeHitsList: { typeId: string; actualCategory: string; algorithmResults: { algoId: string; rank: number }[] }[] = [];
  const fused49 = new Array(49).fill(0);
  const targetDate = estimateTargetDate(data);

  enabledTypes.forEach(type => {
    const getCat = getTypeMapper(type);
    const ranges = getPredictionRanges(type, targetDate);
    const enabledAlgos = type.selectedAlgorithms.filter(ta => globalAlgos.some(ga => ga.id === ta.id && ga.enabled));
    if (enabledAlgos.length === 0) return;

    const weights = enabledAlgos.map(ta => getAlgoWeight(type, ta.id, globalAlgos));
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    if (totalWeight <= 0) return;

    const fused: Record<string, number> = {};
    type.categories.forEach(c => fused[c] = 0);
    const algoRanks: { algoId: string; rank: number }[] = [];

    // 样本外自评：训练只用当期之前的数据，验证对应当期实际（不用于本期预测权重）
    const evalTrain = data.slice(0, -1);

    enabledAlgos.forEach((ta, idx) => {
      const factory = ALGO_FACTORIES[ta.id];
      if (!factory) return;
      const fn = factory(type.categories, getCat);
      const probs = fn(data, seed);
      const w = weights[idx] / totalWeight;

      // 样本外：用最后一期之前的数据重新训练评估
      const lastSeed = evalTrain.length > 0
        ? (evalTrain[evalTrain.length - 1].issue || '0').split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0) & 0x7fffffff
        : seed;
      const evalProbs = fn(evalTrain.length > 0 ? evalTrain : data, lastSeed);
      const evalSorted = type.categories.map(c => ({ c, p: evalProbs[c] || 0 })).sort((a, b) => b.p - a.p);
      const actualSpecial = data.length > 0 ? getCat(data[data.length - 1]) : '';
      const rank = evalSorted.findIndex(x => x.c === actualSpecial) + 1;
      algoRanks.push({ algoId: ta.id, rank: rank > 0 ? rank : 99 });

      type.categories.forEach(c => { fused[c] += (probs[c] || 0) * w; });
    });

    const sum = Object.values(fused).reduce((a, b) => a + b, 0) || 1;
    type.categories.forEach(c => fused[c] /= sum);

    const sorted = type.categories
      .map(c => ({ category: c, probability: fused[c] }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, type.resultCount);

    typeResultsList.push({ typeId: type.id, typeName: type.name, categories: sorted });

    const lastCat = data.length > 0 ? getCat(data[data.length - 1]) : '';
    typeHitsList.push({ typeId: type.id, actualCategory: lastCat, algorithmResults: algoRanks });

    const typeWeight = 1 / enabledTypes.length;
    sorted.forEach(cp => {
      const nums = ranges[type.categories.indexOf(cp.category)] || [];
      nums.forEach(n => { fused49[n - 1] += cp.probability * typeWeight; });
    });
  });

  const total = fused49.reduce((a, b) => a + b, 0) || 1;
  for (let i = 0; i < 49; i++) fused49[i] /= total;

  const finalNumbers = Array.from({ length: 49 }, (_, i) => i + 1)
    .map(n => ({ number: n, probability: fused49[n - 1] }))
    .sort((a, b) => b.probability - a.probability);

  return { typeResults: typeResultsList, typeHits: typeHitsList, finalNumbers };
}

export function autoTuneWeights(
  types: PredictionTypeConfig[],
  _records: DynamicPredictionRecord[],
  data: DrawRecord[],
): PredictionTypeConfig[] {
  if (data.length < 10) return types;
  const globalAlgos: AlgorithmConfig[] = PREDEFINED_ALGOS.map(a => ({ ...a }));
  const evalResult = evaluateAlgorithmsSampleOut(data, globalAlgos, types.filter(t => t.enabled));
  return types.map(type => {
    if (!type.autoWeight) return type;
    const stats = evalResult[type.id];
    if (!stats || Object.keys(stats).length === 0) return type;

    const newAlgos = type.selectedAlgorithms.map(ta => {
      const st = stats[ta.id];
      const hitRate = st ? st.hitRate : 0;
      const weight = hitRate > 0 ? Math.max(0.05, Math.min(1, hitRate * 3)) : 0.05;
      return { ...ta, weight: parseFloat(weight.toFixed(2)), hitRate, hitCount: st?.hitCount || 0, totalCount: st?.totalCount || 0 };
    });

    const totalW = newAlgos.reduce((s, a) => s + a.weight, 0);
    const normalized = totalW > 0 ? newAlgos.map(a => ({ ...a, weight: parseFloat((a.weight / totalW).toFixed(2)) })) : newAlgos;

    return { ...type, selectedAlgorithms: normalized };
  });
}
