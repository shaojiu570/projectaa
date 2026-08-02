/**
 * 六合彩预测系统 - 预测引擎
 * 头数/尾数/五行使用独立模型计算（同步自前端）
 */

const { ZODIACS, EFFECTIVE_NUMBER_MODELS, EFFECTIVE_ZODIAC_MODELS, COLOR_MODELS, SIZE_MODELS, PARITY_MODELS, HEAD_MODELS, HEAD_CATEGORIES, TAIL_MODELS, TAIL_CATEGORIES, ELEMENT_MODELS, ELEMENT_CATEGORIES } = require('./constants.cjs');
const { simulateNumberModel, simulateZodiacModel, simulateColorModel, simulateSizeModel, simulateParityModel, simulateHeadModel, simulateTailModel, simulateElementModel } = require('./models.cjs');
const { getZodiac, getElement } = require('./utils.cjs');

/**
 * 多模型融合（对应前端的 m0 函数）
 */
function fuseModels(data, baseSeed, modelConfigs, modelFn, categories, seedOffset) {
  const totalWeight = modelConfigs.reduce((s, mc) => s + (typeof mc === 'string' ? 1 : (mc.weight || 0)), 0);
  const outputs = modelConfigs.map((mc, i) => {
    const id = typeof mc === 'string' ? mc : mc.id;
    const weight = typeof mc === 'string' ? 1 / modelConfigs.length : (totalWeight > 0 ? mc.weight / totalWeight : 1 / modelConfigs.length);
    return { probs: modelFn(id, data, baseSeed + seedOffset + i * 1000), weight };
  });

  const fused = {};
  categories.forEach(c => fused[c] = 0);
  outputs.forEach(o => {
    Object.entries(o.probs).forEach(([k, v]) => {
      fused[k] = (fused[k] || 0) + o.weight * v;
    });
  });

  const total = Object.values(fused).reduce((a, b) => a + b, 0);
  categories.forEach(c => fused[c] = total > 0 ? (fused[c] || 0) / total : 1 / categories.length);

  return categories
    .map((label, i) => ({ label, probability: fused[label] || 0, rank: 0 }))
    .sort((a, b) => b.probability - a.probability)
    .map((item, i) => ({ ...item, rank: i + 1 }));
}

// 各类型自适应权重的命中判定 TopN
const TOPN = { number: 30, zodiac: 9, head: 4, tail: 8, element: 4 };

/**
 * 判断模型在某一期（test）是否命中：用 train（该期之前的数据）预测，取 TopN 看是否包含实际开奖
 */
function modelHitsAt(id, train, seed, test, type) {
  if (type === 'number') {
    const probs = simulateNumberModel(id, train, seed);
    const top = probs.map((p, i) => ({ n: i + 1, p })).sort((a, b) => b.p - a.p).slice(0, TOPN.number).map(x => x.n);
    return top.includes(test.special);
  }
  if (type === 'zodiac') {
    const probs = simulateZodiacModel(id, train, seed + 10000);
    const top = Object.entries(probs).sort((a, b) => b[1] - a[1]).slice(0, TOPN.zodiac).map(x => x[0]);
    return top.includes(getZodiac(test.special, new Date().getFullYear()));
  }
  if (type === 'head') {
    const probs = simulateHeadModel(id, train, seed);
    const top = Object.entries(probs).sort((a, b) => b[1] - a[1]).slice(0, TOPN.head).map(x => x[0]);
    return top.includes(Math.floor((test.special - 1) / 10).toString() + '头');
  }
  if (type === 'tail') {
    const probs = simulateTailModel(id, train, seed);
    const top = Object.entries(probs).sort((a, b) => b[1] - a[1]).slice(0, TOPN.tail).map(x => x[0]);
    return top.includes((test.special % 10).toString() + '尾');
  }
  if (type === 'element') {
    const probs = simulateElementModel(id, train, seed);
    const top = Object.entries(probs).sort((a, b) => b[1] - a[1]).slice(0, TOPN.element).map(x => x[0]);
    return top.includes(getElement(test.special, new Date().getFullYear()));
  }
  return false;
}

/**
 * 计算自适应权重：每 10 期根据各模型命中情况调整模型权重
 * 对最近 WINDOW=10 期逐期样本外评估（训练只用该期之前的数据），
 * 统计每个模型 TopN 是否命中实际开奖 → softmax 放大命中率 → 归一化为权重。
 * 数据不足 10 期时回退为推送/默认权重。
 */
function computeAdaptiveWeights(data, models, type) {
  const WINDOW = 10;
  if (models.length === 0 || data.length < WINDOW + 1) {
    return models.map(m => ({ id: m.id, weight: m.weight }));
  }

  const testStart = data.length - WINDOW;
  const hits = {};
  models.forEach(m => hits[m.id] = 0);

  for (let pi = testStart; pi < data.length; pi++) {
    const train = data.slice(0, pi);
    const test = data[pi];
    if (train.length === 0) continue;
    const ls = train[train.length - 1]?.issue || '0';
    const seed = ls.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0) & 0x7fffffff;
    models.forEach((m, i) => {
      if (modelHitsAt(m.id, train, seed + i * 1000, test, type)) hits[m.id]++;
    });
  }

  const expScores = models.map(m => ({ id: m.id, exp: Math.exp((hits[m.id] / WINDOW) * 5) }));
  const totalExp = expScores.reduce((s, m) => s + m.exp, 0);

  return expScores.map(m => ({ id: m.id, weight: m.exp / totalExp }));
}

/**
 * 执行预测
 */
function runPrediction(data) {
  const lastIssue = data[data.length - 1]?.issue || '0';
  const baseSeed = lastIssue.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0) & 0x7fffffff;

  // ==================== 号码预测 ====================
  const numWeights = computeAdaptiveWeights(data, EFFECTIVE_NUMBER_MODELS, 'number');
  const numTotal = numWeights.reduce((s, m) => s + m.weight, 0);
  const numOutputs = EFFECTIVE_NUMBER_MODELS.map(m => ({
    probs: simulateNumberModel(m.id, data, baseSeed),
    weight: (numWeights.find(w => w.id === m.id)?.weight || 0) / numTotal,
  }));

  const fusedNum = new Array(49).fill(0);
  numOutputs.forEach(o => {
    for (let i = 0; i < 49; i++) fusedNum[i] += o.weight * o.probs[i];
  });

  const numCands = Array.from({ length: 49 }, (_, i) => i + 1)
    .map(n => ({ number: n, prob: fusedNum[n - 1] }))
    .sort((a, b) => b.prob - a.prob);

  const numberPreds = {
    level1: numCands.slice(0, 30),
    level2: numCands.slice(0, 23),
    level3: numCands.slice(0, 10),
  };

  // ==================== 生肖预测 ====================
  const zodWeights = computeAdaptiveWeights(data, EFFECTIVE_ZODIAC_MODELS, 'zodiac');
  const zodTotal = zodWeights.reduce((s, m) => s + m.weight, 0);
  const zodOutputs = EFFECTIVE_ZODIAC_MODELS.map(m => ({
    probs: simulateZodiacModel(m.id, data, baseSeed + 10000),
    weight: (zodWeights.find(w => w.id === m.id)?.weight || 0) / zodTotal,
  }));

  const fusedZod = {};
  ZODIACS.forEach(z => { fusedZod[z] = 0; });
  zodOutputs.forEach(o => {
    Object.entries(o.probs).forEach(([z, p]) => { fusedZod[z] += o.weight * p; });
  });

  const zodCands = ZODIACS.map(z => ({ zodiac: z, prob: fusedZod[z] }))
    .sort((a, b) => b.prob - a.prob);

  const zodiacPreds = {
    level1: zodCands.slice(0, 9),
    level2: zodCands.slice(0, 6),
    level3: zodCands.slice(0, 3),
  };

  // ==================== 波色预测 ====================
  const colOuts = COLOR_MODELS.map(id => ({
    probs: simulateColorModel(id, data, baseSeed + 2000),
    weight: 1 / 3
  }));

  const fusedCol = { '红波': 0, '蓝波': 0, '绿波': 0 };
  colOuts.forEach(o => {
    Object.entries(o.probs).forEach(([c, p]) => { fusedCol[c] += o.weight * p; });
  });

  const colCands = ['红波', '蓝波', '绿波']
    .map(c => ({ color: c, prob: fusedCol[c] }))
    .sort((a, b) => b.prob - a.prob);

  const colorPreds = {
    level1: colCands.slice(0, 2),
    level2: colCands.slice(0, 1),
  };

  // ==================== 大小预测 ====================
  const sizeOuts = SIZE_MODELS.map(id => ({
    probs: simulateSizeModel(id, data, baseSeed + 3000),
    weight: 1 / 2
  }));

  const fusedSize = { '大': 0, '小': 0 };
  sizeOuts.forEach(o => {
    Object.entries(o.probs).forEach(([s, p]) => { fusedSize[s] += o.weight * p; });
  });

  const sizeCands = ['大', '小']
    .map(s => ({ size: s, prob: fusedSize[s] }))
    .sort((a, b) => b.prob - a.prob);

  const sizePreds = {
    level1: sizeCands,
    level2: sizeCands.slice(0, 1),
  };

  // ==================== 单双预测 ====================
  const parOuts = PARITY_MODELS.map(id => ({
    probs: simulateParityModel(id, data, baseSeed + 4000),
    weight: 1 / 2
  }));

  const fusedPar = { '单': 0, '双': 0 };
  parOuts.forEach(o => {
    Object.entries(o.probs).forEach(([p, v]) => { fusedPar[p] += o.weight * v; });
  });

  const parCands = ['单', '双']
    .map(p => ({ parity: p, prob: fusedPar[p] }))
    .sort((a, b) => b.prob - a.prob);

  const parityPreds = {
    level1: parCands,
    level2: parCands.slice(0, 1),
  };

  // ==================== 头数预测（独立模型，每10期自适应权重） ====================
  const headWeights = computeAdaptiveWeights(data, HEAD_MODELS, 'head');
  const headResult = fuseModels(data, baseSeed, headWeights, simulateHeadModel, HEAD_CATEGORIES, 5000);
  const headPreds = headResult.slice(0, 4).map((item, i) => ({ ...item, rank: i + 1 }));

  // ==================== 尾数预测（独立模型，每10期自适应权重） ====================
  const tailWeights = computeAdaptiveWeights(data, TAIL_MODELS, 'tail');
  const tailResult = fuseModels(data, baseSeed, tailWeights, simulateTailModel, TAIL_CATEGORIES, 6000);
  const tailPreds = tailResult.slice(0, 8).map((item, i) => ({ ...item, rank: i + 1 }));

  // ==================== 五行预测（独立模型，每10期自适应权重） ====================
  const elementWeights = computeAdaptiveWeights(data, ELEMENT_MODELS, 'element');
  const elementResult = fuseModels(data, baseSeed, elementWeights, simulateElementModel, ELEMENT_CATEGORIES, 7000);
  const elementPreds = elementResult.slice(0, 4).map((item, i) => ({ ...item, rank: i + 1 }));

  // ==================== 综合推荐 ====================
  const combos = [];
  for (const z of zodiacPreds.level3) {
    for (const n of numberPreds.level3.slice(0, 5)) {
      combos.push({
        zodiac: z.zodiac,
        number: n.number,
        probability: z.prob * n.prob
      });
    }
  }
  combos.sort((a, b) => b.probability - a.probability);

  return {
    numbers: numberPreds,
    zodiacs: zodiacPreds,
    colors: colorPreds,
    sizes: sizePreds,
    parities: parityPreds,
    combos: combos.slice(0, 2),
    topColor: colCands[0]?.color || '红波',
    topSize: sizeCands[0]?.size || '大',
    topParity: parCands[0]?.parity || '单',
    headPreds,
    tailPreds,
    elementPreds,
  };
}

module.exports = { runPrediction };
