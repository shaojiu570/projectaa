/**
 * 六合彩预测系统 - 模型算法
 * 基于 release34 程序逻辑
 */

const { ZODIACS, HEAD_CATEGORIES, TAIL_CATEGORIES, ELEMENT_CATEGORIES } = require('./constants.cjs');
const { getZodiac, getColor, getSize, getParity, getElement, seededRandom, normalize } = require('./utils.cjs');

/**
 * 全量历史 + 指数衰减计数：覆盖所有开奖记录，但越近的期数权重越高。
 * 半衰期约 34 期（decay=0.98），既充分利用全部历史，又不被远古数据稀释。
 */
function weightedCounts(cats, data, getCat, decay = 0.98) {
  const counts = {};
  cats.forEach(c => counts[c] = 0);
  const n = data.length;
  for (let i = 0; i < n; i++) {
    const w = Math.pow(decay, n - 1 - i);
    const c = getCat(data[i].special);
    counts[c] = (counts[c] || 0) + w;
  }
  return counts;
}

function runGenericAlgo(algoId, cats, getCat, data, seed) {
  const init = () => { const p = {}; cats.forEach(c => p[c] = 0); return p; };
  const norm = (p) => { const s = Object.values(p).reduce((a, b) => a + b, 0) || 1; cats.forEach(c => p[c] /= s); return p; };
  const rngOf = (k) => seededRandom(seed + k);

  switch (algoId) {
    case 'hot': {
      const rng = rngOf(1), p = init();
      const counts = weightedCounts(cats, data, getCat);
      const mf = Math.max(...Object.values(counts), 1);
      cats.forEach(c => p[c] = (counts[c] / mf) * 0.9 + rng() * 0.1);
      return norm(p);
    }
    case 'cold': {
      const rng = rngOf(2), p = init();
      const last = {}; cats.forEach(c => last[c] = -1);
      for (let i = data.length - 1; i >= 0; i--) {
        const c = getCat(data[i].special);
        if (last[c] === -1) last[c] = i;
        if (Object.values(last).every(v => v !== -1)) break;
      }
      const n = data.length;
      const mg = Math.max(...cats.map(c => last[c] === -1 ? n : n - last[c]), 1);
      cats.forEach(c => { const g = last[c] === -1 ? n : n - last[c]; p[c] = (g / mg) * 0.6 + rng() * 0.15; });
      return norm(p);
    }
    case 'cycle': {
      const rng = rngOf(3), p = init();
      const n = data.length;
      cats.forEach(c => {
        const pos = [];
        for (let i = n - 1; i >= 0; i--) {
          if (getCat(data[i].special) === c) { pos.push(i); if (pos.length >= 8) break; }
        }
        pos.reverse();
        if (pos.length >= 2) {
          const gaps = []; for (let i = 1; i < pos.length; i++) gaps.push(pos[i] - pos[i - 1]);
          const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
          const sl = n - 1 - pos[pos.length - 1];
          if (Math.abs(sl - avg) <= 3) p[c] += 0.5; else if (sl > avg) p[c] += 0.3;
        } else if (pos.length === 1) { p[c] += 0.2; }
        p[c] += rng() * 0.05;
      });
      return norm(p);
    }
    case 'markov': {
      if (data.length < 2) { const p = init(); cats.forEach(c => p[c] = 1 / cats.length); return p; }
      const rng = rngOf(4), p = init();
      const trans = {}; cats.forEach(c => { trans[c] = {}; cats.forEach(c2 => trans[c][c2] = 0); });
      for (let i = 1; i < data.length; i++) { const a = getCat(data[i - 1].special); const b = getCat(data[i].special); if (trans[a]) trans[a][b] = (trans[a][b] || 0) + 1; }
      const last = getCat(data[data.length - 1].special);
      if (trans[last]) {
        const total = Object.values(trans[last]).reduce((a, b) => a + b, 0);
        if (total > 0) cats.forEach(c => p[c] = (trans[last][c] || 0) / total * 0.8 + rng() * 0.2);
        else cats.forEach(c => p[c] = 1 / cats.length);
      } else cats.forEach(c => p[c] = 1 / cats.length);
      return norm(p);
    }
    case 'ma': {
      const rng = rngOf(5), p = init();
      const recent = data.slice(-30);
      const weights = [0.5, 0.3, 0.2];
      recent.forEach((d, i) => {
        const ci = recent.length - 1 - i;
        if (ci < weights.length) { const c = getCat(d.special); p[c] = (p[c] || 0) + weights[ci]; }
      });
      cats.forEach(c => p[c] = (p[c] || 0) + rng() * 0.1);
      return norm(p);
    }
    case 'condProb': {
      const rng = rngOf(6), p = init();
      const counts = weightedCounts(cats, data, getCat);
      const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
      cats.forEach(c => p[c] = ((counts[c] || 0) / total) * 0.7 + rng() * 0.3);
      return norm(p);
    }
    case 'bayes': {
      const rng = rngOf(7), p = init();
      const prior = weightedCounts(cats, data, getCat);
      const pt = Object.values(prior).reduce((a, b) => a + b, 0) || 1;
      const last = data.length > 1 ? getCat(data[data.length - 2].special) : '';
      if (last) {
        const cond = {}; cats.forEach(c => cond[c] = 0);
        for (let i = 1; i < data.length; i++) {
          if (getCat(data[i - 1].special) === last) { const c = getCat(data[i].special); cond[c] = (cond[c] || 0) + 1; }
        }
        const ct = Object.values(cond).reduce((a, b) => a + b, 0) || 1;
        cats.forEach(c => p[c] = ((cond[c] || 0) / ct) * 0.6 + ((prior[c] || 0) / pt) * 0.3 + rng() * 0.1);
      } else {
        cats.forEach(c => p[c] = ((prior[c] || 0) / pt) * 0.7 + rng() * 0.3);
      }
      return norm(p);
    }
    case 'apriori': {
      const rng = rngOf(8), p = init();
      const pairs = {}; cats.forEach(c => { pairs[c] = {}; cats.forEach(c2 => pairs[c][c2] = 0); });
      for (let i = 2; i < data.length; i++) {
        const a = getCat(data[i - 2].special); const b = getCat(data[i - 1].special);
        if (pairs[a]) pairs[a][b] = (pairs[a][b] || 0) + 1;
      }
      if (data.length >= 2) {
        const lastTwo = getCat(data[data.length - 2].special);
        if (pairs[lastTwo]) {
          const total = Object.values(pairs[lastTwo]).reduce((a, b) => a + b, 0) || 1;
          cats.forEach(c => p[c] = ((pairs[lastTwo][c] || 0) / total) * 0.7 + rng() * 0.3);
        }
      }
      if (Object.values(p).every(v => v === 0)) cats.forEach(c => p[c] = 1 / cats.length);
      return norm(p);
    }
    case 'rf': {
      const rng = rngOf(9), p = init();
      const recent = data.slice(-300);
      for (let tree = 0; tree < 10; tree++) {
        const tSeed = seededRandom(seed + 100 + tree);
        const sample = [...Array(30)].map(() => recent[Math.floor(tSeed() * recent.length)]).filter(Boolean);
        const votes = {}; cats.forEach(c => votes[c] = 0);
        sample.forEach(d => { const c = getCat(d.special); votes[c] = (votes[c] || 0) + 1; });
        cats.forEach(c => p[c] += (votes[c] || 0) / sample.length);
      }
      cats.forEach(c => p[c] = p[c] / 10 * 0.7 + rng() * 0.3);
      return norm(p);
    }
    case 'xgboost': {
      const rng = rngOf(10), p = init();
      const recent = data.slice(-300);
      for (let boost = 0; boost < 5; boost++) {
        const bSeed = seededRandom(seed + 200 + boost);
        const residuals = {}; cats.forEach(c => residuals[c] = 0);
        const sample = [...Array(20)].map(() => recent[Math.floor(bSeed() * recent.length)]).filter(Boolean);
        sample.forEach(d => { const c = getCat(d.special); residuals[c] = (residuals[c] || 0) + 1; });
        cats.forEach(c => p[c] += ((residuals[c] || 0) / sample.length) * (0.5 + bSeed() * 0.3));
      }
      cats.forEach(c => p[c] = p[c] / 5 + rng() * 0.1);
      return norm(p);
    }
    case 'lstm': {
      const rng = rngOf(11), p = init();
      const recent = data.slice(-60);
      const sequence = [];
      for (let i = 0; i < recent.length; i++) {
        const step = {}; cats.forEach(c => step[c] = 0);
        const c = getCat(recent[i].special); step[c] = 1;
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
      return norm(p);
    }
    case 'genetic': {
      const rng = rngOf(12), p = init();
      const recent = data.slice(-200);
      const popSize = 10;
      const pop = [];
      for (let i = 0; i < popSize; i++) {
        const gSeed = seededRandom(seed + 300 + i);
        const ind = {}; cats.forEach(c => ind[c] = gSeed());
        const s = Object.values(ind).reduce((a, b) => a + b, 0) || 1; cats.forEach(c => ind[c] /= s);
        pop.push(ind);
      }
      for (let gen = 0; gen < 5; gen++) {
        const fitness = pop.map(ind => {
          let score = 0; recent.forEach(d => { const c = getCat(d.special); score += ind[c] || 0; });
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
      return norm(p);
    }
    case 'rl': {
      const rng = rngOf(13), p = init();
      const recent = data.slice(-200);
      const qValues = {}; cats.forEach(c => qValues[c] = rng());
      const lr = 0.1; const discount = 0.9;
      for (let i = 1; i < recent.length; i++) {
        const state = getCat(recent[i - 1].special);
        const action = getCat(recent[i].special);
        const reward = 1;
        if (qValues[state] != null) qValues[state] = qValues[state] + lr * (reward + discount * Math.max(...cats.map(c => qValues[c])) - qValues[state]);
      }
      const expQ = cats.map(c => Math.exp(qValues[c] || 0));
      const sumExp = expQ.reduce((a, b) => a + b, 0) || 1;
      cats.forEach((c, i) => p[c] = (expQ[i] / sumExp) * 0.7 + rng() * 0.3);
      return norm(p);
    }
    case 'bandit': {
      const rng = rngOf(14), p = init();
      const counts = {}; cats.forEach(c => counts[c] = 0);
      const rewards = {}; cats.forEach(c => rewards[c] = 0);
      const n = data.length;
      for (let i = 0; i < n; i++) {
        const w = Math.pow(0.98, n - 1 - i);
        const c = getCat(data[i].special); counts[c] = (counts[c] || 0) + w;
        if (i > 0) { const prev = getCat(data[i - 1].special); if (c === prev) rewards[prev] = (rewards[prev] || 0) + w; }
      }
      cats.forEach(c => {
        const avg = counts[c] ? ((rewards[c] || 0) / counts[c]) : 0;
        const bonus = Math.sqrt(2 * Math.log(n) / (counts[c] || 1));
        p[c] = avg + bonus + rng() * 0.1;
      });
      return norm(p);
    }
    default:
      return init();
  }
}

/**
 * 号码预测模型（统一模型库 = 全部通用算法）
 */
function simulateNumberModel(id, data, baseSeed) {
  const probs = new Array(49).fill(0);
  const cats = Array.from({ length: 49 }, (_, i) => String(i + 1));
  const p = runGenericAlgo(id, cats, n => String(n), data, baseSeed);
  for (let i = 1; i <= 49; i++) probs[i - 1] += p[String(i)] || 0;
  return normalize(probs);
}

/**
 * 生肖预测模型（统一模型库 = 全部通用算法）
 */
function simulateZodiacModel(id, data, baseSeed) {
  const probs = {};
  const currentYear = new Date().getFullYear();
  ZODIACS.forEach(z => { probs[z] = 0; });
  Object.assign(probs, runGenericAlgo(id, ZODIACS, n => getZodiac(n, currentYear), data, baseSeed));
  const total = Object.values(probs).reduce((a, b) => a + b, 0) || 1;
  ZODIACS.forEach(z => probs[z] = probs[z] / total);
  return probs;
}

/**
 * 波色预测模型
 */
function simulateColorModel(id, data, baseSeed) {
  const colors = ['红波', '蓝波', '绿波'], probs = {};
  const rng = seededRandom(baseSeed + id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 2000);
  colors.forEach(c => probs[c] = 0);

  switch (id) {
    case 'color_freq':
      data.slice(-50).forEach((d, i) => {
        probs[getColor(d.special)] += ((i + 1) / 50) * 0.7;
      });
      colors.forEach(c => probs[c] += rng() * 0.1);
      break;
      
    case 'color_trend': {
      const r = data.slice(-30);
      let lastC = getColor(r[0].special);
      for (let i = 1; i < r.length; i++) {
        const curC = getColor(r[i].special);
        if (curC !== lastC) probs[curC] += 0.15;
        lastC = curC;
      }
      r.forEach(d => { probs[getColor(d.special)] += 0.1; });
      colors.forEach(c => probs[c] += rng() * 0.1);
      break;
    }
    
    case 'color_pattern': {
      const seq = data.slice(-40).map(d => getColor(d.special));
      for (let i = 0; i < seq.length - 2; i++) {
        if (seq[i] === seq[i + 2]) probs[seq[i]] += 0.2;
      }
      colors.forEach(c => probs[c] += rng() * 0.2);
      break;
    }
    
    default:
      colors.forEach(c => probs[c] = rng());
  }

  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  colors.forEach(c => probs[c] = total > 0 ? probs[c] / total : 1 / 3);
  return probs;
}

/**
 * 大小预测模型
 */
function simulateSizeModel(id, data, baseSeed) {
  const sizes = { '大': 0, '小': 0 };
  const rng = seededRandom(baseSeed + id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 3000);

  switch (id) {
    case 'size_freq':
      data.slice(-50).forEach((d, i) => {
        sizes[getSize(d.special)] += ((i + 1) / 50) * 0.8;
      });
      break;
      
    case 'size_alternate': {
      const r = data.slice(-30);
      let lastS = getSize(r[0].special), alt = 0;
      for (let i = 1; i < r.length; i++) {
        const curS = getSize(r[i].special);
        if (curS !== lastS) alt++;
        lastS = curS;
      }
      if (alt / r.length > 0.6) sizes[lastS === '大' ? '小' : '大'] += 0.3;
      r.forEach(d => { sizes[getSize(d.special)] += 0.2; });
      break;
    }
      
    default:
      sizes['大'] = rng();
      sizes['小'] = rng();
  }

  sizes['大'] += rng() * 0.1;
  sizes['小'] += rng() * 0.1;
  const total = sizes['大'] + sizes['小'];
  sizes['大'] = total > 0 ? sizes['大'] / total : 0.5;
  sizes['小'] = total > 0 ? sizes['小'] / total : 0.5;
  return sizes;
}

/**
 * 单双预测模型
 */
function simulateParityModel(id, data, baseSeed) {
  const parities = { '单': 0, '双': 0 };
  const rng = seededRandom(baseSeed + id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 4000);

  switch (id) {
    case 'parity_freq':
      data.slice(-50).forEach((d, i) => {
        parities[getParity(d.special)] += ((i + 1) / 50) * 0.8;
      });
      break;
      
    case 'parity_trend': {
      const r = data.slice(-30);
      let lastP = getParity(r[0].special), same = 0;
      for (let i = 1; i < r.length; i++) {
        const curP = getParity(r[i].special);
        if (curP === lastP) same++;
        lastP = curP;
      }
      if (same / r.length > 0.6) parities[lastP] += 0.3;
      r.forEach(d => { parities[getParity(d.special)] += 0.2; });
      break;
    }
      
    default:
      parities['单'] = rng();
      parities['双'] = rng();
  }

  parities['单'] += rng() * 0.1;
  parities['双'] += rng() * 0.1;
  const total = parities['单'] + parities['双'];
  parities['单'] = total > 0 ? parities['单'] / total : 0.5;
  parities['双'] = total > 0 ? parities['双'] / total : 0.5;
  return parities;
}

/**
 * 头数预测模型（统一模型库 = 全部通用算法）
 */
function simulateHeadModel(id, data, baseSeed) {
  const probs = {};
  HEAD_CATEGORIES.forEach(c => probs[c] = 0);
  Object.assign(probs, runGenericAlgo(id, HEAD_CATEGORIES, n => Math.floor((n - 1) / 10).toString() + '头', data, baseSeed));
  const total = Object.values(probs).reduce((a, b) => a + b, 0) || 1;
  HEAD_CATEGORIES.forEach(c => probs[c] = probs[c] / total);
  return probs;
}

/**
 * 尾数预测模型（统一模型库 = 全部通用算法）
 */
function simulateTailModel(id, data, baseSeed) {
  const probs = {};
  TAIL_CATEGORIES.forEach(c => probs[c] = 0);
  Object.assign(probs, runGenericAlgo(id, TAIL_CATEGORIES, n => (n % 10).toString() + '尾', data, baseSeed));
  const total = Object.values(probs).reduce((a, b) => a + b, 0) || 1;
  TAIL_CATEGORIES.forEach(c => probs[c] = probs[c] / total);
  return probs;
}

/**
 * 五行预测模型（统一模型库 = 全部通用算法）
 */
function simulateElementModel(id, data, baseSeed) {
  const probs = {};
  const currentYear = new Date().getFullYear();
  ELEMENT_CATEGORIES.forEach(c => probs[c] = 0);
  Object.assign(probs, runGenericAlgo(id, ELEMENT_CATEGORIES, n => getElement(n, currentYear), data, baseSeed));
  const total = Object.values(probs).reduce((a, b) => a + b, 0) || 1;
  ELEMENT_CATEGORIES.forEach(c => probs[c] = probs[c] / total);
  return probs;
}

module.exports = {
  simulateNumberModel,
  simulateZodiacModel,
  simulateColorModel,
  simulateSizeModel,
  simulateParityModel,
  simulateHeadModel,
  simulateTailModel,
  simulateElementModel,
};
