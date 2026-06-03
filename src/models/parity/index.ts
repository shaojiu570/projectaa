import { DrawRecord } from '../../data/types';
import { seededRandom } from '../../utils/helpers';
import { getParity } from '../../constants/parity';

export function parityFreqModel(data: DrawRecord[], baseSeed: number): Record<string, number> {
  const parities: Record<string, number> = { '单': 0, '双': 0 };
  const seed = baseSeed + 'parity_freq'.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 4000;
  const rng = seededRandom(seed);
  const recent = data.slice(-50);
  recent.forEach((d, i) => {
    const parity = getParity(d.special);
    parities[parity] += ((i + 1) / recent.length) * 0.8;
  });
  parities['单'] += rng() * 0.1;
  parities['双'] += rng() * 0.1;
  const total = parities['单'] + parities['双'];
  parities['单'] = total > 0 ? parities['单'] / total : 0.5;
  parities['双'] = total > 0 ? parities['双'] / total : 0.5;
  return parities;
}

export function parityTrendModel(data: DrawRecord[], baseSeed: number): Record<string, number> {
  const parities: Record<string, number> = { '单': 0, '双': 0 };
  const seed = baseSeed + 'parity_trend'.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 4000;
  const rng = seededRandom(seed);
  const recent = data.slice(-30);
  let lastParity = getParity(recent[0].special);
  let same = 0;
  for (let i = 1; i < recent.length; i++) {
    const currentParity = getParity(recent[i].special);
    if (currentParity === lastParity) same++;
    lastParity = currentParity;
  }
  if (same / recent.length > 0.6) {
    parities[lastParity] += 0.3;
  }
  recent.forEach(d => {
    parities[getParity(d.special)] += 0.2;
  });
  parities['单'] += rng() * 0.1;
  parities['双'] += rng() * 0.1;
  const total = parities['单'] + parities['双'];
  parities['单'] = total > 0 ? parities['单'] / total : 0.5;
  parities['双'] = total > 0 ? parities['双'] / total : 0.5;
  return parities;
}

export const parityModelFunctions: Record<string, (data: DrawRecord[], baseSeed: number) => Record<string, number>> = {
  parity_freq: parityFreqModel,
  parity_trend: parityTrendModel,
};

export const PARITY_MODELS = ['parity_freq', 'parity_trend'];
