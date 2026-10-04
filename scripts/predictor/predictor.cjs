/**
 * 六合彩预测系统 - 预测引擎
 * 完全对齐前端 src/models/dynamic/index.ts 的设计：
 *  - 算法、权重融合公式一致
 *  - seed 偏移公式一致
 *  - 类型 resultCount / finalCount 夹紧函数一致
 *  - 新增 autoWeight 自动调权（evaluateAlgorithmsSampleOut + autoTuneWeights）
 *  - 新增 typeHits 自评排名（与前端 typeHits 同名）
 *  - 输出结构新增 typeResults 字段（前端同源名）
 */

const {
  EFFECTIVE_TYPES,
  FINAL_COUNT,
  buildTypeMapper,
  getYearZodiacMapping,
  getLunarZodiacYear,
  YEAR_ELEMENTS,
  ZODIACS,
  LICHUN_DATES,
} = require('./constants.cjs');
const {
  runGenericAlgo,
  autoTuneWeights,
  evaluateAlgorithmsSampleOut,
} = require('./models.cjs');

/* =====================================================
 * 统一夹紧函数（与前端 computeTopN / 前端 finalCount 输入夹紧保持一致）
 * ===================================================== */

/** 类型推荐数量夹紧：[1, min(resultCount, 分类数)] */
function clampResultCount(type) {
  const total = (type && Array.isArray(type.categories)) ? type.categories.length : 1;
  const want = typeof type.resultCount === 'number' ? type.resultCount : (typeof type.topN === 'number' ? type.topN : 5);
  const floor = Math.floor(want);
  return Math.max(1, Math.min((Number.isFinite(floor) && floor > 0) ? floor : 1, total));
}

/** 综合推荐号码数量夹紧：[1, 49] */
function clampFinalCount(count) {
  const c = typeof count === 'number' ? count : 10;
  const floor = Math.floor(c);
  return Math.max(1, Math.min((Number.isFinite(floor) && floor > 0) ? floor : 10, 49));
}

/* =====================================================
 * 算法融合（完全对齐前端 fuseModels）：
 *   输入：type, data, baseSeed, typeIdx, seedOffset
 *   输出：各分类的 fused 概率（总和=1）
 *   seed 偏移：seed = baseSeed + seedOffset + i*1000  （与前端完全相同）
 * ===================================================== */

function fuseModelsRaw(type, data, baseSeed, typeIdx, seedOffset = 0) {
  const ranges = type.categories || [];
  const getCat = buildTypeMapper(type);
  const enabledAlgos = (type.selectedAlgorithms || []).filter(sa =>
    sa && sa.id && typeof (sa.weight ?? 1) === 'number' && (sa.weight ?? 0) > 0
  );
  if (enabledAlgos.length === 0) return null;

  const weights = enabledAlgos.map(sa => sa.weight || 0);
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (totalWeight <= 0) return null;

  const fused = {};
  ranges.forEach(r => { fused[r] = 0; });

  enabledAlgos.forEach((sa, i) => {
    const probs = runGenericAlgo(sa.id, ranges, getCat, data, baseSeed + seedOffset + i * 1000);
    const w = weights[i] / totalWeight;
    ranges.forEach(r => { fused[r] += (probs[r] || 0) * w; });
  });

  const total = Object.values(fused).reduce((s, v) => s + v, 0) || 1;
  ranges.forEach(r => { fused[r] /= total; });
  return fused;
}

/* =====================================================
 * 目标期日期 / 动态号码段（对齐前端 estimateTargetDate / getPredictionRanges）
 * ===================================================== */

function estimateTargetDate(data) {
  if (!data || data.length === 0) return new Date();
  const last = data[data.length - 1];
  const d = new Date(last.Date || last.date || Date.now());
  d.setDate(d.getDate() + 2);
  return d;
}

function getPredictionRanges(type, targetDate) {
  if (!type) return [];
  const id = typeof type.id === 'string' ? type.id : '';
  if (id !== 'zodiac' && id !== 'element') return type.numberRanges || [];
  const year = targetDate.getFullYear();
  if (id === 'zodiac') {
    const map = getYearZodiacMapping(getLunarZodiacYear(targetDate));
    return (type.categories || []).map(c => map[c] || []);
  }
  if (id === 'element') {
    const table = YEAR_ELEMENTS[year] || YEAR_ELEMENTS[2026];
    return (type.categories || []).map(c => table[c] || []);
  }
  return type.numberRanges || [];
}

/* =====================================================
 * 主预测函数：runPrediction(data, finalCount, types, options)
 *
 * 参数：
 *   - data：开奖记录数组（支持 Issue/Date/Num1~6/Special 或 issue/date/normals/special 两种结构）
 *   - finalCount：综合推荐号码数量（可选，默认取 constants.FINAL_COUNT 或 10）
 *   - types：类型配置列表（可选，默认 constants.EFFECTIVE_TYPES）
 *   - options.useAutoWeight：是否在预测前对 autoWeight=true 的类型应用自动调权（默认 true）
 *   - options.print：自动调权时是否打印日志（默认 false，由入口 index.cjs 控制）
 *
 * 返回（与前端返回结构同名）：
 *   {
 *     typeResults: [{ typeId, typeName, resultCount, numberRanges,
 *                     categories: [{category, probability}],
 *                     predictions: [{category,index,probability}] }],
 *     typeHits:     [{ typeId, actualCategory, algorithmResults: [{algoId, rank}] }],
 *     finalNumbers: [{ number, probability }],
 *     finalCount,
 *     baseSeed,
 *     targetDate,
 *     // 脚本兼容性字段（保留旧命名，不影响一致性）
 *     types: ...,
 *   }
 * ===================================================== */

function runPrediction(data, finalCount, types, options = {}) {
  const { useAutoWeight = true, print = false } = options;

  /* 规范化 data 的结构，使 mapper 能统一从 record.special 读特码 */
  const normData = (data || []).map(r => {
    if (r && typeof r === 'object' && ('special' in r || 'Special' in r)) {
      const d = {
        issue: r.issue || r.Issue || '',
        date: r.date || r.Date || '',
        special: typeof r.special === 'number' ? r.special : r.Special,
      };
      if (Array.isArray(r.normals)) {
        [d.n1, d.n2, d.n3, d.n4, d.n5, d.n6] = r.normals;
      } else {
        d.n1 = r.n1 ?? r.Num1; d.n2 = r.n2 ?? r.Num2;
        d.n3 = r.n3 ?? r.Num3; d.n4 = r.n4 ?? r.Num4;
        d.n5 = r.n5 ?? r.Num5; d.n6 = r.n6 ?? r.Num6;
      }
      return d;
    }
    return r;
  });

  // 1) 类型/数量默认值 + 夹紧
  const inTypes = Array.isArray(types) && types.length > 0 ? types : EFFECTIVE_TYPES;
  const inCount = clampFinalCount(typeof finalCount === 'number' ? finalCount : FINAL_COUNT);
  const effTypes = useAutoWeight ? autoTuneWeights(inTypes, normData, { print }) : inTypes;
  const enabledTypes = (effTypes || []).filter(t => t && t.enabled !== false);

  // 2) 基准 seed（与前端相同：lastIssue 字符串逐字符 × 31 + charCode，再 & 0x7fffffff）
  const lastIssue = (normData.length && normData[normData.length - 1])
    ? (normData[normData.length - 1].issue || '')
    : '';
  const baseSeed = String(lastIssue).split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0) & 0x7fffffff;
  const targetDate = estimateTargetDate(normData);

  const typeResults = [];
  const typeHits = [];
  const fused49 = new Array(49).fill(0);
  const typeWeight = enabledTypes.length > 0 ? 1 / enabledTypes.length : 0;

  enabledTypes.forEach((type, typeIdx) => {
    const resultCount = clampResultCount(type);
    const ranges = type.categories || [];
    const effectiveRanges = getPredictionRanges(type, targetDate);
    const fused = fuseModelsRaw(type, normData, baseSeed, typeIdx, 1000 + typeIdx * 100);
    if (!fused) return;

    // 类别全排序
    const sorted = ranges
      .map((c, i) => ({ category: c, probability: fused[c] || 0, index: i }))
      .sort((a, b) => b.probability - a.probability);
    const topResults = sorted.slice(0, resultCount);

    // 对齐前端返回：categories 数组 = {category, probability}
    typeResults.push({
      typeId: type.id,
      typeName: type.name,
      resultCount,
      numberRanges: effectiveRanges,
      categories: topResults.map(p => ({ category: p.category, probability: p.probability })),
      predictions: topResults, // 脚本兼容字段
    });

    // 自评 typeHits：用倒数第二期训练，对倒数第一期做"该类型实际分类是什么 + 每个算法排第几名"
    try {
      if (normData.length >= 2) {
        const getCat = buildTypeMapper(type);
        const lastRecord = normData[normData.length - 1];
        const trainForEval = normData.slice(0, -1);
        const actual = getCat(lastRecord);
        const algosForEval = (type.selectedAlgorithms || []).filter(sa => sa && sa.id);
        const algorithmResults = algosForEval.map((sa, i) => {
          const probs = runGenericAlgo(
            sa.id, ranges, getCat, trainForEval,
            baseSeed + 1000 + typeIdx * 100 + i * 1000,
          );
          const rank = ranges
            .map(c => ({ c, p: probs[c] || 0 }))
            .sort((a, b) => b.p - a.p)
            .findIndex(x => x.c === actual) + 1;
          return { algoId: sa.id, rank: rank || ranges.length };
        });
        typeHits.push({ typeId: type.id, actualCategory: actual, algorithmResults });
      }
    } catch (e) {
      // 自评失败不影响主流程
    }

    // fused49：只有 Top resultCount 的类别按概率累加到对应号码段
    topResults.forEach(cp => {
      const nums = effectiveRanges[cp.index >= 0 ? cp.index : ranges.indexOf(cp.category)] || [];
      nums.forEach(n => {
        if (typeof n === 'number' && n >= 1 && n <= 49) {
          fused49[n - 1] += cp.probability * typeWeight;
        }
      });
    });
  });

  // finalNumbers：49 个号码归一化 → 按概率降序 → 取 Top finalCount
  const totalF = fused49.reduce((s, v) => s + v, 0) || 1;
  for (let i = 0; i < 49; i++) fused49[i] /= totalF;
  const finalNumbers = Array.from({ length: 49 }, (_, i) => i + 1)
    .map(n => ({ number: n, probability: fused49[n - 1] }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, inCount);

  return {
    // 与前端同源命名
    typeResults,
    typeHits,
    finalNumbers,
    finalCount: finalNumbers.length,
    baseSeed,
    targetDate,

    // 脚本兼容旧命名（保留 types = typeResults 的别名，方便旧代码使用）
    types: typeResults.map(tr => ({
      id: tr.typeId,
      name: tr.typeName,
      resultCount: tr.resultCount,
      topN: tr.resultCount,
      numberRanges: tr.numberRanges,
      predictions: tr.predictions,
    })),
  };
}

module.exports = {
  runPrediction,
  fuseModels: fuseModelsRaw,
  evaluateAlgorithmsSampleOut,
  autoTuneWeights,
  clampResultCount,
  clampFinalCount,
  estimateTargetDate,
  getPredictionRanges,
};
