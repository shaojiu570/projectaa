import { DrawRecord } from '../../data/types';
import { seededRandom } from '../../utils/helpers';
import { getZodiacByNumber } from '../../utils/lunarCalendar';
import { ModelConfig } from '../../data/types';

const zodiacs = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

function getRecordZodiac(d: DrawRecord): string {
  return getZodiacByNumber(new Date(d.date), d.special);
}

export function zodiacResnetModel(data: DrawRecord[], baseSeed: number): Record<string, number> {
  const probs: Record<string, number> = {};
  const seed = baseSeed + 'zodiac_resnet'.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 1000;
  const rng = seededRandom(seed);
  zodiacs.forEach(z => { probs[z] = 0; });
  const lastSeen: Record<string, number> = {};
  zodiacs.forEach(z => { lastSeen[z] = 0; });
  for (let i = data.length - 1; i >= 0; i--) {
    const z = getRecordZodiac(data[i]);
    if (lastSeen[z] === 0) lastSeen[z] = data.length - i;
    if (Object.values(lastSeen).every(v => v > 0)) break;
  }
  zodiacs.forEach(z => {
    const missing = lastSeen[z] || data.length;
    probs[z] = Math.log(missing + 1);
  });
  zodiacs.forEach(z => { probs[z] += rng() * 0.05; });
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  zodiacs.forEach(z => { probs[z] = total > 0 ? probs[z] / total : 1 / 12; });
  return probs;
}

export function zodiacLstmModel(data: DrawRecord[], baseSeed: number): Record<string, number> {
  const probs: Record<string, number> = {};
  const seed = baseSeed + 'zodiac_lstm'.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 1000;
  const rng = seededRandom(seed);
  zodiacs.forEach(z => { probs[z] = 0; });
  const recent = data.slice(-80);
  const transitions: Record<string, Record<string, number>> = {};
  zodiacs.forEach(z => { transitions[z] = {}; zodiacs.forEach(z2 => { transitions[z][z2] = 0.1; }); });
  for (let i = 0; i < recent.length - 1; i++) {
    const from = getRecordZodiac(recent[i]);
    const to = getRecordZodiac(recent[i + 1]);
    transitions[from][to] += 1;
  }
  const lastZ = getRecordZodiac(data[data.length - 1]);
  const row = transitions[lastZ];
  const total = Object.values(row).reduce((a, b) => a + b, 0);
  zodiacs.forEach(z => { probs[z] = row[z] / total; });
  zodiacs.forEach(z => { probs[z] += rng() * 0.02; });
  const normTotal = Object.values(probs).reduce((a, b) => a + b, 0);
  zodiacs.forEach(z => { probs[z] = normTotal > 0 ? probs[z] / normTotal : 1 / 12; });
  return probs;
}

export function zodiacMarkovModel(data: DrawRecord[], baseSeed: number): Record<string, number> {
  const probs: Record<string, number> = {};
  const seed = baseSeed + 'zodiac_markov'.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 1000;
  const rng = seededRandom(seed);
  zodiacs.forEach(z => { probs[z] = 0; });
  if (data.length >= 2) {
    const recent = data.slice(-100);
    const transitions2: Record<string, Record<string, number>> = {};
    for (let i = 0; i < recent.length - 2; i++) {
      const key = `${getRecordZodiac(recent[i])}_${getRecordZodiac(recent[i + 1])}`;
      const to = getRecordZodiac(recent[i + 2]);
      if (!transitions2[key]) { transitions2[key] = {}; zodiacs.forEach(z => { transitions2[key][z] = 0.1; }); }
      transitions2[key][to] += 1;
    }
    const key2 = `${getRecordZodiac(data[data.length - 2])}_${getRecordZodiac(data[data.length - 1])}`;
    if (transitions2[key2]) {
      const total = Object.values(transitions2[key2]).reduce((a, b) => a + b, 0);
      zodiacs.forEach(z => { probs[z] = transitions2[key2][z] / total; });
    } else {
      zodiacs.forEach(z => { probs[z] = 1 / 12; });
    }
  } else {
    zodiacs.forEach(z => { probs[z] = 1 / 12; });
  }
  zodiacs.forEach(z => { probs[z] += rng() * 0.02; });
  const normTotal = Object.values(probs).reduce((a, b) => a + b, 0);
  zodiacs.forEach(z => { probs[z] = normTotal > 0 ? probs[z] / normTotal : 1 / 12; });
  return probs;
}

export function zodiacPatternModel(data: DrawRecord[], baseSeed: number): Record<string, number> {
  const probs: Record<string, number> = {};
  const seed = baseSeed + 'zodiac_pattern'.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 1000;
  const rng = seededRandom(seed);
  zodiacs.forEach(z => { probs[z] = 0; });
  const gaps: Record<string, number[]> = {};
  zodiacs.forEach(z => { gaps[z] = []; });
  const lastPos: Record<string, number> = {};
  for (let i = 0; i < data.length; i++) {
    const z = getRecordZodiac(data[i]);
    if (lastPos[z] !== undefined) gaps[z].push(i - lastPos[z]);
    lastPos[z] = i;
  }
  const currentMissing: Record<string, number> = {};
  zodiacs.forEach(z => { currentMissing[z] = 0; });
  for (let i = data.length - 1; i >= 0; i--) {
    const z = getRecordZodiac(data[i]);
    if (currentMissing[z] === 0) currentMissing[z] = data.length - 1 - i;
    if (Object.values(currentMissing).every(v => v > 0)) break;
  }
  zodiacs.forEach(z => {
    const avgGap = gaps[z].length > 0
      ? gaps[z].reduce((a, b) => a + b, 0) / gaps[z].length
      : 12;
    const missing = currentMissing[z] || 0;
    const ratio = missing / avgGap;
    probs[z] = ratio > 1 ? ratio : ratio * 0.5;
  });
  zodiacs.forEach(z => { probs[z] += rng() * 0.05; });
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  zodiacs.forEach(z => { probs[z] = total > 0 ? probs[z] / total : 1 / 12; });
  return probs;
}

export function zodiacFreqModel(data: DrawRecord[], baseSeed: number): Record<string, number> {
  const probs: Record<string, number> = {};
  const seed = baseSeed + 'zodiac_freq'.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 1000;
  const rng = seededRandom(seed);
  zodiacs.forEach(z => { probs[z] = 0; });
  const recent30 = data.slice(-30);
  const freq: Record<string, number> = {};
  zodiacs.forEach(z => { freq[z] = 0; });
  recent30.forEach(d => { freq[getRecordZodiac(d)]++; });
  const avgFreq = 30 / 12;
  zodiacs.forEach(z => {
    const f = freq[z];
    probs[z] = f < avgFreq ? (avgFreq - f + 1) : 1 / (f + 1);
  });
  zodiacs.forEach(z => { probs[z] += rng() * 0.05; });
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  zodiacs.forEach(z => { probs[z] = total > 0 ? probs[z] / total : 1 / 12; });
  return probs;
}

export function zodiacComboModel(data: DrawRecord[], baseSeed: number): Record<string, number> {
  const probs: Record<string, number> = {};
  const seed = baseSeed + 'zodiac_combo'.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 1000;
  const rng = seededRandom(seed);
  zodiacs.forEach(z => { probs[z] = 0; });
  const lastSeen2: Record<string, number> = {};
  zodiacs.forEach(z => { lastSeen2[z] = 0; });
  for (let i = data.length - 1; i >= 0; i--) {
    const z = getRecordZodiac(data[i]);
    if (lastSeen2[z] === 0) lastSeen2[z] = data.length - i;
    if (Object.values(lastSeen2).every(v => v > 0)) break;
  }
  const missingScore: Record<string, number> = {};
  zodiacs.forEach(z => { missingScore[z] = Math.log((lastSeen2[z] || data.length) + 1); });
  const recentC = data.slice(-60);
  const transC: Record<string, Record<string, number>> = {};
  zodiacs.forEach(z => { transC[z] = {}; zodiacs.forEach(z2 => { transC[z][z2] = 0.1; }); });
  for (let i = 0; i < recentC.length - 1; i++) {
    transC[getRecordZodiac(recentC[i])][getRecordZodiac(recentC[i + 1])] += 1;
  }
  const lastZC = getRecordZodiac(data[data.length - 1]);
  const rowC = transC[lastZC];
  const totalC = Object.values(rowC).reduce((a, b) => a + b, 0);
  const markovScore: Record<string, number> = {};
  zodiacs.forEach(z => { markovScore[z] = rowC[z] / totalC; });
  const ms = Math.max(...Object.values(missingScore));
  const mk = Math.max(...Object.values(markovScore));
  zodiacs.forEach(z => {
    probs[z] = 0.5 * (missingScore[z] / ms) + 0.5 * (markovScore[z] / mk);
    probs[z] += rng() * 0.02;
  });
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  zodiacs.forEach(z => { probs[z] = total > 0 ? probs[z] / total : 1 / 12; });
  return probs;
}

export function zodiacCondProbModel(data: DrawRecord[], baseSeed: number): Record<string, number> {
  const probs: Record<string, number> = {};
  const seed = baseSeed + 'zodiac_condprob'.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 1000;
  const rng = seededRandom(seed);
  zodiacs.forEach(z => { probs[z] = 0; });
  if (data.length < 2) { zodiacs.forEach(z => { probs[z] = 1 / 12; }); return probs; }

  const recent = data.slice(-60);
  const zodiacHeads: Record<string, Record<string, number>> = {};
  const zodiacTails: Record<string, Record<string, number>> = {};
  zodiacs.forEach(z => { zodiacHeads[z] = {}; zodiacTails[z] = {}; [0,1,2,3,4].forEach(h => zodiacHeads[z][String(h)] = 0.1); [0,1,2,3,4,5,6,7,8,9].forEach(t => zodiacTails[z][String(t)] = 0.1); });

  for (let i = 0; i < recent.length; i++) {
    const z = getRecordZodiac(recent[i]);
    const head = String(Math.floor(recent[i].special / 10));
    const tail = String(recent[i].special % 10);
    if (zodiacHeads[z][head] != null) zodiacHeads[z][head]++;
    if (zodiacTails[z][tail] != null) zodiacTails[z][tail]++;
  }

  const lastZ = getRecordZodiac(recent[recent.length - 1]);
  const lastNum = recent[recent.length - 1].special;
  const lastHead = String(Math.floor(lastNum / 10));
  const lastTail = String(lastNum % 10);

  zodiacs.forEach(z => {
    let score = 0; let count = 0;
    if (zodiacHeads[lastZ] && zodiacHeads[lastZ][lastHead] != null) { score += zodiacHeads[lastZ][lastHead]; count++; }
    if (zodiacTails[lastZ] && zodiacTails[lastZ][lastTail] != null) { score += zodiacTails[lastZ][lastTail]; count++; }
    probs[z] = count > 0 ? score / count : 1 / 12;
  });

  zodiacs.forEach(z => { probs[z] += rng() * 0.05; });
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  zodiacs.forEach(z => { probs[z] = total > 0 ? probs[z] / total : 1 / 12; });
  return probs;
}

export function zodiacBayesModel(data: DrawRecord[], baseSeed: number): Record<string, number> {
  const probs: Record<string, number> = {};
  const seed = baseSeed + 'zodiac_bayes'.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 1000;
  const rng = seededRandom(seed);
  zodiacs.forEach(z => { probs[z] = 0; });
  if (data.length < 20) { zodiacs.forEach(z => { probs[z] = 1 / 12; }); return probs; }

  const recent = data.slice(-40);
  const prior: Record<string, number> = {};
  zodiacs.forEach(z => { prior[z] = 0; });
  recent.forEach(d => { prior[getRecordZodiac(d)]++; });
  const priorTotal = Object.values(prior).reduce((a, b) => a + b, 0) || 1;
  zodiacs.forEach(z => { prior[z] = prior[z] / priorTotal; });

  const lastMissing: Record<string, number> = {};
  zodiacs.forEach(z => { lastMissing[z] = 0; });
  for (let i = data.length - 1; i >= 0; i--) {
    const z = getRecordZodiac(data[i]);
    if (lastMissing[z] === 0) lastMissing[z] = data.length - i;
    if (Object.values(lastMissing).every(v => v > 0)) break;
  }
  const maxMissing = Math.max(...Object.values(lastMissing), 1);

  zodiacs.forEach(z => {
    const missingLikelihood = (lastMissing[z] || data.length) / maxMissing;
    const priorP = prior[z] || 0.01;
    probs[z] = missingLikelihood * priorP;
  });

  zodiacs.forEach(z => { probs[z] += rng() * 0.03; });
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  zodiacs.forEach(z => { probs[z] = total > 0 ? probs[z] / total : 1 / 12; });
  return probs;
}

function createZodiacFallback(id: string): (data: DrawRecord[], baseSeed: number) => Record<string, number> {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return (data, baseSeed) => {
    const rng = seededRandom(baseSeed + hash + 1000);
    const probs: Record<string, number> = {};
    zodiacs.forEach(z => { probs[z] = rng(); });
    const total = Object.values(probs).reduce((a, b) => a + b, 0);
    zodiacs.forEach(z => { probs[z] = total > 0 ? probs[z] / total : 1 / 12; });
    return probs;
  };
}

export function randomZodiacModel(data: DrawRecord[], baseSeed: number): Record<string, number> {
  const rng = seededRandom(baseSeed + 1000);
  const probs: Record<string, number> = {};
  zodiacs.forEach(z => { probs[z] = rng(); });
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  zodiacs.forEach(z => { probs[z] = total > 0 ? probs[z] / total : 1 / 12; });
  return probs;
}

export const zodiacModelFunctions: Record<string, (data: DrawRecord[], baseSeed: number) => Record<string, number>> = {
  zodiac_resnet: zodiacResnetModel,
  zodiac_lstm: zodiacLstmModel,
  zodiac_markov: zodiacMarkovModel,
  zodiac_pattern: zodiacPatternModel,
  zodiac_freq: zodiacFreqModel,
  zodiac_combo: zodiacComboModel,
  zodiac_condProb: zodiacCondProbModel,
  zodiac_bayes: zodiacBayesModel,
};

export const DEFAULT_ZODIAC_MODELS: ModelConfig[] = [
  { id: 'zodiac_resnet', name: '生肖-遗漏值', desc: '最久未出现的生肖概率更高', enabled: true, weight: 0.20 },
  { id: 'zodiac_lstm', name: '生肖-一阶马尔可夫', desc: '基于上期生肖的转移概率', enabled: true, weight: 0.15 },
  { id: 'zodiac_markov', name: '生肖-二阶马尔可夫', desc: '基于前两期生肖的转移概率', enabled: true, weight: 0.15 },
  { id: 'zodiac_pattern', name: '生肖-周期分析', desc: '遗漏与平均间隔对比', enabled: true, weight: 0.10 },
  { id: 'zodiac_freq', name: '生肖-冷热均衡', desc: '近30期低频生肖反向加权', enabled: true, weight: 0.10 },
  { id: 'zodiac_combo', name: '生肖-综合融合', desc: '遗漏+马尔可夫融合', enabled: true, weight: 0.10 },
  { id: 'zodiac_condProb', name: '生肖-条件概率', desc: '基于号码头尾数的条件概率', enabled: true, weight: 0.10 },
  { id: 'zodiac_bayes', name: '生肖-贝叶斯', desc: '遗漏似然×先验概率', enabled: true, weight: 0.10 },
];
