/**
 * 六合彩预测系统 - 模型算法
 * 基于 release34 程序逻辑
 */

const { ZODIACS } = require('./constants.cjs');
const { getZodiac, getColor, getSize, getParity, getElement, seededRandom, normalize } = require('./utils.cjs');

/**
 * 号码预测模型
 */
function simulateNumberModel(id, data, baseSeed) {
  const probs = new Array(49).fill(0);
  const rng = seededRandom(baseSeed + id.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
  const recent = data.slice(-50);
  const currentYear = new Date().getFullYear();

  switch (id) {
    case 'resnet': {
      recent.forEach((d, i) => { probs[d.special - 1] += ((i + 1) / recent.length) * 0.6; });
      for (let i = 1; i < recent.length; i++) {
        const gap = recent[i].special - recent[i - 1].special;
        const next = recent[i].special + gap;
        if (next >= 1 && next <= 49) probs[next - 1] += 0.2;
      }
      for (let i = 0; i < 49; i++) probs[i] += rng() * 0.2;
      break;
    }
    
    case 'color_markov': {
      const r = data.slice(-40), trans = {};
      for (let i = 0; i < r.length - 1; i++) {
        const f = getColor(r[i].special), t = getColor(r[i + 1].special);
        if (!trans[f]) trans[f] = {};
        trans[f][t] = (trans[f][t] || 0) + 1;
      }
      const last = getColor(r[r.length - 1].special);
      if (trans[last]) {
        const total = Object.values(trans[last]).reduce((a, b) => a + b, 0);
        Object.entries(trans[last]).forEach(([c, cnt]) => {
          for (let n = 1; n <= 49; n++) {
            if (getColor(n) === c) probs[n - 1] += (cnt / total) * 0.6;
          }
        });
      }
      for (let i = 0; i < 49; i++) probs[i] += rng() * 0.15;
      break;
    }
    
    case 'element_markov': {
      const r = data.slice(-40), trans = {};
      for (let i = 0; i < r.length - 1; i++) {
        const f = getElement(r[i].special, currentYear), t = getElement(r[i + 1].special, currentYear);
        if (!trans[f]) trans[f] = {};
        trans[f][t] = (trans[f][t] || 0) + 1;
      }
      const last = getElement(r[r.length - 1].special, currentYear);
      if (trans[last]) {
        const total = Object.values(trans[last]).reduce((a, b) => a + b, 0);
        Object.entries(trans[last]).forEach(([e, cnt]) => {
          for (let n = 1; n <= 49; n++) {
            if (getElement(n, currentYear) === e) probs[n - 1] += (cnt / total) * 0.6;
          }
        });
      }
      for (let i = 0; i < 49; i++) probs[i] += rng() * 0.15;
      break;
    }
    
    case 'size_markov': {
      const r = data.slice(-40), trans = {};
      for (let i = 0; i < r.length - 1; i++) {
        const f = getSize(r[i].special), t = getSize(r[i + 1].special);
        if (!trans[f]) trans[f] = {};
        trans[f][t] = (trans[f][t] || 0) + 1;
      }
      const last = getSize(r[r.length - 1].special);
      if (trans[last]) {
        const total = Object.values(trans[last]).reduce((a, b) => a + b, 0);
        Object.entries(trans[last]).forEach(([s, cnt]) => {
          for (let n = 1; n <= 49; n++) {
            if (getSize(n) === s) probs[n - 1] += (cnt / total) * 0.6;
          }
        });
      }
      for (let i = 0; i < 49; i++) probs[i] += rng() * 0.15;
      break;
    }
    
    case 'parity_markov': {
      const r = data.slice(-40), trans = {};
      for (let i = 0; i < r.length - 1; i++) {
        const f = getParity(r[i].special), t = getParity(r[i + 1].special);
        if (!trans[f]) trans[f] = {};
        trans[f][t] = (trans[f][t] || 0) + 1;
      }
      const last = getParity(r[r.length - 1].special);
      if (trans[last]) {
        const total = Object.values(trans[last]).reduce((a, b) => a + b, 0);
        Object.entries(trans[last]).forEach(([p, cnt]) => {
          for (let n = 1; n <= 49; n++) {
            if (getParity(n) === p) probs[n - 1] += (cnt / total) * 0.6;
          }
        });
      }
      for (let i = 0; i < 49; i++) probs[i] += rng() * 0.15;
      break;
    }
    
    case 'hot_trend': {
      const r = data.slice(-30), freq = new Array(49).fill(0);
      r.forEach(d => { freq[d.special - 1]++; });
      const maxFreq = Math.max(...freq);
      for (let i = 0; i < 49; i++) {
        probs[i] += (freq[i] / maxFreq) * 0.8;
        probs[i] += rng() * 0.2;
      }
      break;
    }
    
    case 'cold_trend': {
      const r = data.slice(-50), lastA = new Array(49).fill(-1);
      for (let i = r.length - 1; i >= 0; i--) {
        if (lastA[r[i].special - 1] === -1) lastA[r[i].special - 1] = i;
      }
      const maxGap = Math.max(...lastA.map(v => v === -1 ? 50 : r.length - v));
      for (let i = 0; i < 49; i++) {
        const gap = lastA[i] === -1 ? 50 : r.length - lastA[i];
        probs[i] += (gap / maxGap) * 0.6;
        probs[i] += rng() * 0.3;
      }
      break;
    }
    
    case 'ma_trend': {
      const r = data.slice(-20), specials = r.map(d => d.special);
      const ma5 = specials.slice(-5).reduce((a, b) => a + b, 0) / 5;
      const ma10 = specials.slice(-10).reduce((a, b) => a + b, 0) / 10;
      const trend = ma5 - ma10;
      for (let i = 0; i < 49; i++) {
        const dev = i - ma5;
        if ((trend > 0 && dev > 0) || (trend < 0 && dev < 0)) probs[i] += 0.3;
        probs[i] += Math.max(0, 0.4 - Math.abs(dev) * 0.02);
        probs[i] += rng() * 0.25;
      }
      break;
    }
    
    default:
      for (let i = 0; i < 49; i++) probs[i] = rng();
  }
  
  return normalize(probs);
}

/**
 * 生肖预测模型
 */
function simulateZodiacModel(id, data, baseSeed) {
  const probs = {};
  const rng = seededRandom(baseSeed + id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 1000);
  const currentYear = new Date().getFullYear();
  
  ZODIACS.forEach(z => { probs[z] = 0; });

  switch (id) {
    case 'zodiac_resnet': {
      const lastSeen = {};
      ZODIACS.forEach(z => { lastSeen[z] = 0; });
      for (let i = data.length - 1; i >= 0; i--) {
        const z = getZodiac(data[i].special, currentYear);
        if (lastSeen[z] === 0) lastSeen[z] = data.length - i;
        if (Object.values(lastSeen).every(v => v > 0)) break;
      }
      ZODIACS.forEach(z => { probs[z] = Math.log((lastSeen[z] || data.length) + 1); });
      ZODIACS.forEach(z => { probs[z] += rng() * 0.05; });
      break;
    }
    
    case 'zodiac_lstm': {
      const r = data.slice(-80), trans = {};
      ZODIACS.forEach(z => {
        trans[z] = {};
        ZODIACS.forEach(z2 => { trans[z][z2] = 0.1; });
      });
      for (let i = 0; i < r.length - 1; i++) {
        trans[getZodiac(r[i].special, currentYear)][getZodiac(r[i + 1].special, currentYear)] += 1;
      }
      const lastZ = getZodiac(data[data.length - 1].special, currentYear), row = trans[lastZ];
      const total = Object.values(row).reduce((a, b) => a + b, 0);
      ZODIACS.forEach(z => { probs[z] = row[z] / total; });
      ZODIACS.forEach(z => { probs[z] += rng() * 0.02; });
      break;
    }
    
    case 'zodiac_markov': {
      if (data.length >= 2) {
        const r = data.slice(-100), trans2 = {};
        for (let i = 0; i < r.length - 2; i++) {
          const key = getZodiac(r[i].special, currentYear) + '_' + getZodiac(r[i + 1].special, currentYear);
          const to = getZodiac(r[i + 2].special, currentYear);
          if (!trans2[key]) {
            trans2[key] = {};
            ZODIACS.forEach(z => { trans2[key][z] = 0.1; });
          }
          trans2[key][to] += 1;
        }
        const key2 = getZodiac(data[data.length - 2].special, currentYear) + '_' + getZodiac(data[data.length - 1].special, currentYear);
        if (trans2[key2]) {
          const total = Object.values(trans2[key2]).reduce((a, b) => a + b, 0);
          ZODIACS.forEach(z => { probs[z] = trans2[key2][z] / total; });
        } else {
          ZODIACS.forEach(z => { probs[z] = 1 / 12; });
        }
      } else {
        ZODIACS.forEach(z => { probs[z] = 1 / 12; });
      }
      ZODIACS.forEach(z => { probs[z] += rng() * 0.02; });
      break;
    }
    
    case 'zodiac_pattern': {
      const gaps = {};
      ZODIACS.forEach(z => { gaps[z] = []; });
      const lastPos = {};
      for (let i = 0; i < data.length; i++) {
        const z = getZodiac(data[i].special, currentYear);
        if (lastPos[z] !== undefined) gaps[z].push(i - lastPos[z]);
        lastPos[z] = i;
      }
      const curMissing = {};
      ZODIACS.forEach(z => { curMissing[z] = 0; });
      for (let i = data.length - 1; i >= 0; i--) {
        const z = getZodiac(data[i].special, currentYear);
        if (curMissing[z] === 0) curMissing[z] = data.length - 1 - i;
        if (Object.values(curMissing).every(v => v > 0)) break;
      }
      ZODIACS.forEach(z => {
        const avgGap = gaps[z].length > 0 ? gaps[z].reduce((a, b) => a + b, 0) / gaps[z].length : 12;
        const ratio = (curMissing[z] || 0) / avgGap;
        probs[z] = ratio > 1 ? ratio : ratio * 0.5;
      });
      ZODIACS.forEach(z => { probs[z] += rng() * 0.05; });
      break;
    }
    
    case 'zodiac_freq': {
      const r30 = data.slice(-30), freq = {};
      ZODIACS.forEach(z => { freq[z] = 0; });
      r30.forEach(d => { freq[getZodiac(d.special, currentYear)]++; });
      const avgFreq = 30 / 12;
      ZODIACS.forEach(z => {
        const f = freq[z];
        probs[z] = f < avgFreq ? (avgFreq - f + 1) : 1 / (f + 1);
      });
      ZODIACS.forEach(z => { probs[z] += rng() * 0.05; });
      break;
    }
    
    case 'zodiac_combo': {
      const lastSeen2 = {};
      ZODIACS.forEach(z => { lastSeen2[z] = 0; });
      for (let i = data.length - 1; i >= 0; i--) {
        const z = getZodiac(data[i].special, currentYear);
        if (lastSeen2[z] === 0) lastSeen2[z] = data.length - i;
        if (Object.values(lastSeen2).every(v => v > 0)) break;
      }
      const missScore = {};
      ZODIACS.forEach(z => { missScore[z] = Math.log((lastSeen2[z] || data.length) + 1); });
      const rC = data.slice(-60), transC = {};
      ZODIACS.forEach(z => {
        transC[z] = {};
        ZODIACS.forEach(z2 => { transC[z][z2] = 0.1; });
      });
      for (let i = 0; i < rC.length - 1; i++) {
        transC[getZodiac(rC[i].special, currentYear)][getZodiac(rC[i + 1].special, currentYear)] += 1;
      }
      const lastZC = getZodiac(data[data.length - 1].special, currentYear), rowC = transC[lastZC];
      const totalC = Object.values(rowC).reduce((a, b) => a + b, 0);
      const markovScore = {};
      ZODIACS.forEach(z => { markovScore[z] = rowC[z] / totalC; });
      const ms = Math.max(...Object.values(missScore)), mk = Math.max(...Object.values(markovScore));
      ZODIACS.forEach(z => {
        probs[z] = 0.5 * (missScore[z] / ms) + 0.5 * (markovScore[z] / mk);
        probs[z] += rng() * 0.02;
      });
      break;
    }
    
    default:
      ZODIACS.forEach(z => { probs[z] = rng(); });
  }
  
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  ZODIACS.forEach(z => { probs[z] = total > 0 ? probs[z] / total : 1 / 12; });
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

module.exports = {
  simulateNumberModel,
  simulateZodiacModel,
  simulateColorModel,
  simulateSizeModel,
  simulateParityModel
};
