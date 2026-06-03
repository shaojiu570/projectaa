/**
 * 六合彩预测系统 - 预测引擎
 * 基于 release34 程序逻辑
 */

const { ZODIACS, DEFAULT_NUMBER_MODELS, DEFAULT_ZODIAC_MODELS, COLOR_MODELS, SIZE_MODELS, PARITY_MODELS } = require('./constants.cjs');
const { simulateNumberModel, simulateZodiacModel, simulateColorModel, simulateSizeModel, simulateParityModel } = require('./models.cjs');
const { getZodiac } = require('./utils.cjs');

/**
 * 计算自适应权重
 */
function computeAdaptiveWeights(data, models, type) {
  if (models.length === 0 || data.length < 30) {
    return models.map(m => ({ id: m.id, weight: m.weight }));
  }

  const evalData = data.slice(-60);
  const windowSize = 15;
  const allScores = models.map(m => ({ id: m.id, scores: [] }));

  for (let si = 0; si <= evalData.length - windowSize - 1; si += 2) {
    const train = evalData.slice(si, si + windowSize);
    const test = evalData[si + windowSize];
    if (!test) continue;

    for (const m of models) {
      const ls = train[train.length - 1]?.issue || '0';
      const seed = ls.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0) & 0x7fffffff;
      let hit = false;

      if (type === 'number') {
        const probs = simulateNumberModel(m.id, train, seed);
        // 用 level1 标准（38个）评估
        const top38 = probs.map((p, i) => ({ n: i + 1, p }))
          .sort((a, b) => b.p - a.p)
          .slice(0, 38)
          .map(x => x.n);
        hit = top38.includes(test.special);
      } else {
        const probs = simulateZodiacModel(m.id, train, seed + 10000);
        // 用 level1 标准（9个）评估
        const top9 = Object.entries(probs)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 9)
          .map(x => x[0]);
        hit = top9.includes(getZodiac(test.special, new Date().getFullYear()));
      }

      const ex = allScores.find(s => s.id === m.id);
      if (ex) ex.scores.push(hit ? 1 : 0);
    }
  }

  const modelScores = allScores.map(m => ({
    id: m.id,
    avgScore: Math.max(0.01, m.scores.reduce((a, b) => a + b, 0) / (m.scores.length || 1))
  }));

  const expScores = modelScores.map(m => ({ id: m.id, exp: Math.exp(m.avgScore * 5) }));
  const totalExp = expScores.reduce((s, m) => s + m.exp, 0);

  return expScores.map(m => ({ id: m.id, weight: m.exp / totalExp }));
}

/**
 * 执行预测
 */
function runPrediction(data) {
  const lastIssue = data[data.length - 1]?.issue || '0';
  const baseSeed = lastIssue.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0) & 0x7fffffff;
  const currentYear = new Date().getFullYear();

  // ==================== 号码预测 ====================
  // 三层漏斗：38 → 23 → 10
  const numWeights = computeAdaptiveWeights(data, DEFAULT_NUMBER_MODELS, 'number');
  const numTotal = numWeights.reduce((s, m) => s + m.weight, 0);
  const numOutputs = DEFAULT_NUMBER_MODELS.map(m => ({
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
    level1: numCands.slice(0, 38),  // 第一层：38个
    level2: numCands.slice(0, 23),  // 第二层：23个
    level3: numCands.slice(0, 10),  // 第三层：10个
  };

  // ==================== 生肖预测 ====================
  // 三层漏斗：9 → 6 → 3
  const zodWeights = computeAdaptiveWeights(data, DEFAULT_ZODIAC_MODELS, 'zodiac');
  const zodTotal = zodWeights.reduce((s, m) => s + m.weight, 0);
  const zodOutputs = DEFAULT_ZODIAC_MODELS.map(m => ({
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
    level1: zodCands.slice(0, 9),   // 第一层：9个
    level2: zodCands.slice(0, 6),   // 第二层：6个
    level3: zodCands.slice(0, 3),   // 第三层：3个
  };

  // ==================== 波色预测 ====================
  // 两层漏斗：2 → 1
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
    level1: colCands.slice(0, 2),  // 第一层：2个
    level2: colCands.slice(0, 1),  // 第二层：1个
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
  };
}

module.exports = { runPrediction };
