/**
 * 六合彩预测系统 - 模型算法
 * 基于 release34 程序逻辑
 */

const { ZODIACS, HEAD_CATEGORIES, TAIL_CATEGORIES, ELEMENT_CATEGORIES } = require('./constants.cjs');
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
    
    case 'zodiac_condProb': {
      if (data.length < 2) { ZODIACS.forEach(z => { probs[z] = 1 / 12; }); break; }
      const rCp = data.slice(-60);
      const zHeads = {}, zTails = {};
      ZODIACS.forEach(z => { zHeads[z] = {}; zTails[z] = {}; [0,1,2,3,4].forEach(h => zHeads[z][h] = 0.1); [0,1,2,3,4,5,6,7,8,9].forEach(t => zTails[z][t] = 0.1); });
      rCp.forEach(d => {
        const z = getZodiac(d.special, currentYear);
        const head = Math.floor(d.special / 10), tail = d.special % 10;
        if (zHeads[z][head] != null) zHeads[z][head]++;
        if (zTails[z][tail] != null) zTails[z][tail]++;
      });
      const lz = getZodiac(rCp[rCp.length - 1].special, currentYear);
      const ln = rCp[rCp.length - 1].special, lh = Math.floor(ln / 10), lt = ln % 10;
      ZODIACS.forEach(z => {
        let score = 0, count = 0;
        if (zHeads[lz] && zHeads[lz][lh] != null) { score += zHeads[lz][lh]; count++; }
        if (zTails[lz] && zTails[lz][lt] != null) { score += zTails[lz][lt]; count++; }
        probs[z] = count > 0 ? score / count : 1 / 12;
      });
      ZODIACS.forEach(z => { probs[z] += rng() * 0.05; });
      break;
    }
    case 'zodiac_bayes': {
      if (data.length < 20) { ZODIACS.forEach(z => { probs[z] = 1 / 12; }); break; }
      const rBy = data.slice(-40);
      const prior = {};
      ZODIACS.forEach(z => { prior[z] = 0; });
      rBy.forEach(d => { prior[getZodiac(d.special, currentYear)]++; });
      const priorTotal = Object.values(prior).reduce((a, b) => a + b, 0) || 1;
      ZODIACS.forEach(z => { prior[z] = prior[z] / priorTotal; });
      const lastMissing = {};
      ZODIACS.forEach(z => { lastMissing[z] = 0; });
      for (let i = data.length - 1; i >= 0; i--) {
        const z = getZodiac(data[i].special, currentYear);
        if (lastMissing[z] === 0) lastMissing[z] = data.length - i;
        if (Object.values(lastMissing).every(v => v > 0)) break;
      }
      const maxMissing = Math.max(...Object.values(lastMissing), 1);
      ZODIACS.forEach(z => {
        probs[z] = ((lastMissing[z] || data.length) / maxMissing) * (prior[z] || 0.01);
      });
      ZODIACS.forEach(z => { probs[z] += rng() * 0.03; });
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

/**
 * 头数预测模型
 */
function simulateHeadModel(id, data, baseSeed) {
  const probs = {};
  const rng = seededRandom(baseSeed + id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 5000);
  HEAD_CATEGORIES.forEach(c => probs[c] = 0);

  switch (id) {
    case 'head_freq': {
      data.slice(-50).forEach((d, i) => {
        const h = Math.floor((d.special - 1) / 10).toString() + '头';
        probs[h] += ((i + 1) / 50) * 0.8;
      });
      HEAD_CATEGORIES.forEach(c => probs[c] += rng() * 0.1);
      break;
    }
    case 'head_markov': {
      const r = data.slice(-40), trans = {};
      HEAD_CATEGORIES.forEach(c => { trans[c] = {}; HEAD_CATEGORIES.forEach(c2 => trans[c][c2] = 0.1); });
      for (let i = 0; i < r.length - 1; i++) {
        const f = Math.floor((r[i].special - 1) / 10).toString() + '头';
        const t = Math.floor((r[i + 1].special - 1) / 10).toString() + '头';
        trans[f][t] += 1;
      }
      const last = Math.floor((r[r.length - 1].special - 1) / 10).toString() + '头';
      const total = Object.values(trans[last]).reduce((a, b) => a + b, 0);
      HEAD_CATEGORIES.forEach(c => { probs[c] = trans[last][c] / total; });
      HEAD_CATEGORIES.forEach(c => probs[c] += rng() * 0.05);
      break;
    }
    case 'head_trend': {
      const seq = data.slice(-40).map(d => Math.floor((d.special - 1) / 10).toString() + '头');
      for (let i = 0; i < seq.length - 2; i++) {
        if (seq[i] === seq[i + 2]) probs[seq[i]] += 0.25;
      }
      data.slice(-30).forEach((d, i) => {
        const h = Math.floor((d.special - 1) / 10).toString() + '头';
        probs[h] += ((i + 1) / 30) * 0.3;
      });
      HEAD_CATEGORIES.forEach(c => probs[c] += rng() * 0.1);
      break;
    }
    case 'head_pattern': {
      const lastPosH = {}, gapsH = {};
      HEAD_CATEGORIES.forEach(c => { gapsH[c] = []; });
      for (let i = 0; i < data.length; i++) {
        const h = Math.floor((data[i].special - 1) / 10).toString() + '头';
        if (lastPosH[h] !== undefined) gapsH[h].push(i - lastPosH[h]);
        lastPosH[h] = i;
      }
      const curMissingH = {};
      HEAD_CATEGORIES.forEach(c => { curMissingH[c] = 0; });
      for (let i = data.length - 1; i >= 0; i--) {
        const h = Math.floor((data[i].special - 1) / 10).toString() + '头';
        if (curMissingH[h] === 0) curMissingH[h] = data.length - 1 - i;
        if (Object.values(curMissingH).every(v => v > 0)) break;
      }
      HEAD_CATEGORIES.forEach(c => {
        const avgGap = gapsH[c].length > 0 ? gapsH[c].reduce((a, b) => a + b, 0) / gapsH[c].length : 10;
        const ratio = (curMissingH[c] || 0) / avgGap;
        probs[c] = ratio > 1 ? ratio : ratio * 0.5;
      });
      HEAD_CATEGORIES.forEach(c => probs[c] += rng() * 0.05);
      break;
    }
    case 'head_combo': {
      const rHc = data.slice(-50), freqH = {};
      HEAD_CATEGORIES.forEach(c => { freqH[c] = 0; });
      rHc.forEach(d => { freqH[Math.floor((d.special - 1) / 10).toString() + '头']++; });
      const maxFreqH = Math.max(...Object.values(freqH), 1);
      const transH = {};
      HEAD_CATEGORIES.forEach(c => { transH[c] = {}; HEAD_CATEGORIES.forEach(c2 => transH[c][c2] = 0.1); });
      for (let i = 1; i < rHc.length; i++) {
        const f = Math.floor((rHc[i - 1].special - 1) / 10).toString() + '头';
        const t = Math.floor((rHc[i].special - 1) / 10).toString() + '头';
        transH[f][t]++;
      }
      const lastHc = Math.floor((rHc[rHc.length - 1].special - 1) / 10).toString() + '头';
      const rowH = transH[lastHc];
      const rowTotalH = Object.values(rowH).reduce((a, b) => a + b, 0);
      HEAD_CATEGORIES.forEach(c => {
        probs[c] = (freqH[c] / maxFreqH) * 0.4 + (rowH[c] / rowTotalH) * 0.6;
      });
      HEAD_CATEGORIES.forEach(c => probs[c] += rng() * 0.03);
      break;
    }
    default:
      HEAD_CATEGORIES.forEach(c => probs[c] = rng());
  }

  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  HEAD_CATEGORIES.forEach(c => probs[c] = total > 0 ? probs[c] / total : 1 / HEAD_CATEGORIES.length);
  return probs;
}

/**
 * 尾数预测模型
 */
function simulateTailModel(id, data, baseSeed) {
  const probs = {};
  const rng = seededRandom(baseSeed + id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 6000);
  TAIL_CATEGORIES.forEach(c => probs[c] = 0);

  switch (id) {
    case 'tail_freq': {
      data.slice(-50).forEach((d, i) => {
        const t = (d.special % 10).toString() + '尾';
        probs[t] += ((i + 1) / 50) * 0.8;
      });
      TAIL_CATEGORIES.forEach(c => probs[c] += rng() * 0.1);
      break;
    }
    case 'tail_markov': {
      const r = data.slice(-40), trans = {};
      TAIL_CATEGORIES.forEach(c => { trans[c] = {}; TAIL_CATEGORIES.forEach(c2 => trans[c][c2] = 0.1); });
      for (let i = 0; i < r.length - 1; i++) {
        const f = (r[i].special % 10).toString() + '尾';
        const t = (r[i + 1].special % 10).toString() + '尾';
        trans[f][t] += 1;
      }
      const last = (r[r.length - 1].special % 10).toString() + '尾';
      const total = Object.values(trans[last]).reduce((a, b) => a + b, 0);
      TAIL_CATEGORIES.forEach(c => { probs[c] = trans[last][c] / total; });
      TAIL_CATEGORIES.forEach(c => probs[c] += rng() * 0.05);
      break;
    }
    case 'tail_trend': {
      const seq = data.slice(-40).map(d => (d.special % 10).toString() + '尾');
      for (let i = 0; i < seq.length - 2; i++) {
        if (seq[i] === seq[i + 2]) probs[seq[i]] += 0.25;
      }
      data.slice(-30).forEach((d, i) => {
        const t = (d.special % 10).toString() + '尾';
        probs[t] += ((i + 1) / 30) * 0.3;
      });
      TAIL_CATEGORIES.forEach(c => probs[c] += rng() * 0.1);
      break;
    }
    case 'tail_pattern': {
      const lastPosT = {}, gapsT = {};
      TAIL_CATEGORIES.forEach(c => { gapsT[c] = []; });
      for (let i = 0; i < data.length; i++) {
        const t = (data[i].special % 10).toString() + '尾';
        if (lastPosT[t] !== undefined) gapsT[t].push(i - lastPosT[t]);
        lastPosT[t] = i;
      }
      const curMissingT = {};
      TAIL_CATEGORIES.forEach(c => { curMissingT[c] = 0; });
      for (let i = data.length - 1; i >= 0; i--) {
        const t = (data[i].special % 10).toString() + '尾';
        if (curMissingT[t] === 0) curMissingT[t] = data.length - 1 - i;
        if (Object.values(curMissingT).every(v => v > 0)) break;
      }
      TAIL_CATEGORIES.forEach(c => {
        const avgGap = gapsT[c].length > 0 ? gapsT[c].reduce((a, b) => a + b, 0) / gapsT[c].length : 10;
        const ratio = (curMissingT[c] || 0) / avgGap;
        probs[c] = ratio > 1 ? ratio : ratio * 0.5;
      });
      TAIL_CATEGORIES.forEach(c => probs[c] += rng() * 0.05);
      break;
    }
    case 'tail_combo': {
      const rTc = data.slice(-50), freqT = {};
      TAIL_CATEGORIES.forEach(c => { freqT[c] = 0; });
      rTc.forEach(d => { freqT[(d.special % 10).toString() + '尾']++; });
      const maxFreqT = Math.max(...Object.values(freqT), 1);
      const transT = {};
      TAIL_CATEGORIES.forEach(c => { transT[c] = {}; TAIL_CATEGORIES.forEach(c2 => transT[c][c2] = 0.1); });
      for (let i = 1; i < rTc.length; i++) {
        const f = (rTc[i - 1].special % 10).toString() + '尾';
        const t = (rTc[i].special % 10).toString() + '尾';
        transT[f][t]++;
      }
      const lastTc = (rTc[rTc.length - 1].special % 10).toString() + '尾';
      const rowT = transT[lastTc];
      const rowTotalT = Object.values(rowT).reduce((a, b) => a + b, 0);
      TAIL_CATEGORIES.forEach(c => {
        probs[c] = (freqT[c] / maxFreqT) * 0.4 + (rowT[c] / rowTotalT) * 0.6;
      });
      TAIL_CATEGORIES.forEach(c => probs[c] += rng() * 0.03);
      break;
    }
    default:
      TAIL_CATEGORIES.forEach(c => probs[c] = rng());
  }

  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  TAIL_CATEGORIES.forEach(c => probs[c] = total > 0 ? probs[c] / total : 1 / TAIL_CATEGORIES.length);
  return probs;
}

/**
 * 五行预测模型
 */
function simulateElementModel(id, data, baseSeed) {
  const probs = {};
  const rng = seededRandom(baseSeed + id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 7000);
  const currentYear = new Date().getFullYear();
  ELEMENT_CATEGORIES.forEach(c => probs[c] = 0);

  switch (id) {
    case 'element_freq': {
      data.slice(-50).forEach((d, i) => {
        const elem = getElement(d.special, currentYear);
        probs[elem] += ((i + 1) / 50) * 0.8;
      });
      ELEMENT_CATEGORIES.forEach(c => probs[c] += rng() * 0.1);
      break;
    }
    case 'element_markov': {
      const r = data.slice(-40), trans = {};
      ELEMENT_CATEGORIES.forEach(c => { trans[c] = {}; ELEMENT_CATEGORIES.forEach(c2 => trans[c][c2] = 0.1); });
      for (let i = 0; i < r.length - 1; i++) {
        const f = getElement(r[i].special, currentYear);
        const t = getElement(r[i + 1].special, currentYear);
        trans[f][t] += 1;
      }
      const last = getElement(r[r.length - 1].special, currentYear);
      const total = Object.values(trans[last]).reduce((a, b) => a + b, 0);
      ELEMENT_CATEGORIES.forEach(c => { probs[c] = trans[last][c] / total; });
      ELEMENT_CATEGORIES.forEach(c => probs[c] += rng() * 0.05);
      break;
    }
    case 'element_trend': {
      const seq = data.slice(-40).map(d => getElement(d.special, currentYear));
      for (let i = 0; i < seq.length - 2; i++) {
        if (seq[i] === seq[i + 2]) probs[seq[i]] += 0.25;
      }
      data.slice(-30).forEach((d, i) => {
        const elem = getElement(d.special, currentYear);
        probs[elem] += ((i + 1) / 30) * 0.3;
      });
      ELEMENT_CATEGORIES.forEach(c => probs[c] += rng() * 0.1);
      break;
    }
    case 'element_pattern': {
      const lastPosE = {}, gapsE = {};
      ELEMENT_CATEGORIES.forEach(c => { gapsE[c] = []; });
      for (let i = 0; i < data.length; i++) {
        const e = getElement(data[i].special, currentYear);
        if (!ELEMENT_CATEGORIES.includes(e)) continue;
        if (lastPosE[e] !== undefined) gapsE[e].push(i - lastPosE[e]);
        lastPosE[e] = i;
      }
      const curMissingE = {};
      ELEMENT_CATEGORIES.forEach(c => { curMissingE[c] = 0; });
      for (let i = data.length - 1; i >= 0; i--) {
        const e = getElement(data[i].special, currentYear);
        if (!ELEMENT_CATEGORIES.includes(e)) continue;
        if (curMissingE[e] === 0) curMissingE[e] = data.length - 1 - i;
        if (Object.values(curMissingE).every(v => v > 0)) break;
      }
      ELEMENT_CATEGORIES.forEach(c => {
        const avgGap = gapsE[c].length > 0 ? gapsE[c].reduce((a, b) => a + b, 0) / gapsE[c].length : 10;
        const ratio = (curMissingE[c] || 0) / avgGap;
        probs[c] = ratio > 1 ? ratio : ratio * 0.5;
      });
      ELEMENT_CATEGORIES.forEach(c => probs[c] += rng() * 0.05);
      break;
    }
    case 'element_combo': {
      const rEc = data.slice(-50), freqE = {};
      ELEMENT_CATEGORIES.forEach(c => { freqE[c] = 0; });
      rEc.forEach(d => {
        const e = getElement(d.special, currentYear);
        if (ELEMENT_CATEGORIES.includes(e)) freqE[e]++;
      });
      const maxFreqE = Math.max(...Object.values(freqE), 1);
      const transE = {};
      ELEMENT_CATEGORIES.forEach(c => { transE[c] = {}; ELEMENT_CATEGORIES.forEach(c2 => transE[c][c2] = 0.1); });
      for (let i = 1; i < rEc.length; i++) {
        const f = getElement(rEc[i - 1].special, currentYear);
        const t = getElement(rEc[i].special, currentYear);
        if (ELEMENT_CATEGORIES.includes(f) && ELEMENT_CATEGORIES.includes(t)) transE[f][t]++;
      }
      const lastEc = getElement(rEc[rEc.length - 1].special, currentYear);
      const lastCatE = ELEMENT_CATEGORIES.includes(lastEc) ? lastEc : ELEMENT_CATEGORIES[0];
      const rowE = transE[lastCatE];
      const rowTotalE = Object.values(rowE).reduce((a, b) => a + b, 0);
      ELEMENT_CATEGORIES.forEach(c => {
        probs[c] = (freqE[c] / maxFreqE) * 0.4 + (rowE[c] / rowTotalE) * 0.6;
      });
      ELEMENT_CATEGORIES.forEach(c => probs[c] += rng() * 0.03);
      break;
    }
    default:
      ELEMENT_CATEGORIES.forEach(c => probs[c] = rng());
  }

  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  ELEMENT_CATEGORIES.forEach(c => probs[c] = total > 0 ? probs[c] / total : 1 / ELEMENT_CATEGORIES.length);
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
