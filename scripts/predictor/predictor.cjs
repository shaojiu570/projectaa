/**
 * 六合彩预测系统 - 预测引擎
 * 完全由推送的「动态预测类型」驱动（任意类型：号码/生肖/头/尾/五行/自定义）
 */

const { EFFECTIVE_TYPES, FINAL_COUNT, buildTypeMapper, getYearZodiacMapping, getLunarZodiacYear, YEAR_ELEMENTS } = require('./constants.cjs');
const { simulateTypeModel } = require('./models.cjs');

/**
 * 多模型融合：对某类型的所有已选算法按权重融合，返回排序后的类别列表
 */
function fuseModels(data, baseSeed, weights, type, seedOffset) {
  const totalWeight = weights.reduce((s, w) => s + (w.weight || 0), 0);
  const fused = {};
  type.categories.forEach(c => fused[c] = 0);

  weights.forEach((w, i) => {
    const probs = simulateTypeModel(w.id, type, data, baseSeed + seedOffset + i * 1000);
    const wt = totalWeight > 0 ? (w.weight || 0) / totalWeight : 1 / weights.length;
    type.categories.forEach(c => fused[c] += (probs[c] || 0) * wt);
  });

  const total = Object.values(fused).reduce((a, b) => a + b, 0) || 1;
  type.categories.forEach(c => fused[c] /= total);

  return type.categories
    .map((c, i) => ({ category: c, index: i, probability: fused[c] || 0 }))
    .sort((a, b) => b.probability - a.probability);
}

/**
 * 判断模型在某一期（test）是否命中：用 train（该期之前的数据）预测，取 TopN 看是否包含实际开奖
 */
function modelHitsAt(id, train, seed, test, type) {
  const getCat = buildTypeMapper(type);
  const probs = simulateTypeModel(id, type, train, seed);
  const topN = type.topN || Math.max(type.resultCount || 1, 1);
  const top = type.categories
    .map(c => ({ c, p: probs[c] || 0 }))
    .sort((a, b) => b.p - a.p)
    .slice(0, topN)
    .map(x => x.c);
  return top.includes(getCat(test));
}

/**
 * 预测目标期的号码映射：内置生肖/五行按目标期日期动态生成（生肖按立春/农历年、五行按日历年），
 * 其余类型（号码/头/尾/自定义）用推送配置中的 numberRanges。
 */
function effectiveRanges(type, targetDate) {
  if (type.isBuiltin && type.id === 'zodiac') {
    const map = getYearZodiacMapping(getLunarZodiacYear(targetDate));
    return type.categories.map(c => map[c] || []);
  }
  if (type.isBuiltin && type.id === 'element') {
    const map = YEAR_ELEMENTS[targetDate.getFullYear()] || YEAR_ELEMENTS[2026];
    return type.categories.map(c => map[c] || []);
  }
  return type.numberRanges || [];
}

/**
 * 执行预测（使用推送的固定权重，不再自动调整）
 */
function runPrediction(data) {
  const lastIssue = data[data.length - 1]?.issue || '0';
  const baseSeed = lastIssue.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0) & 0x7fffffff;

  const targetDate = new Date(new Date(data[data.length - 1]?.date || Date.now()));
  targetDate.setDate(targetDate.getDate() + 1);

  const enabled = EFFECTIVE_TYPES.filter(t => t.enabled !== false);

  // 各类型预测：使用推送的固定权重
  const perType = enabled.map((type, typeIdx) => {
    const algos = (type.selectedAlgorithms || []).filter(sa => sa && sa.id);
    if (algos.length === 0) return null;
    const sorted = fuseModels(data, baseSeed, algos, type, 1000 + typeIdx * 100);
    const count = Math.max(1, Math.min(type.resultCount || 5, sorted.length));
    return {
      id: type.id,
      name: type.name,
      resultCount: count,
      topN: type.topN || count,
      numberRanges: effectiveRanges(type, targetDate),
      predictions: sorted.slice(0, count),
    };
  }).filter(Boolean);

  // 综合推荐号码：所有类型推荐类别的号码按概率融合
  const fused49 = new Array(49).fill(0);
  perType.forEach(pt => {
    const tw = 1 / perType.length;
    pt.predictions.forEach(cp => {
      const nums = pt.numberRanges[cp.index] || [];
      nums.forEach(n => { fused49[n - 1] += cp.probability * tw; });
    });
  });
  const total = fused49.reduce((a, b) => a + b, 0) || 1;
  for (let i = 0; i < 49; i++) fused49[i] /= total;

  const finalNumbers = Array.from({ length: 49 }, (_, i) => i + 1)
    .map(n => ({ number: n, probability: fused49[n - 1] }))
    .sort((a, b) => b.probability - a.probability);

  return {
    types: perType,
    finalNumbers,
    finalCount: Math.max(1, FINAL_COUNT || 10),
  };
}

module.exports = { runPrediction };
