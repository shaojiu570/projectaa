import { DrawRecord } from '../../data/types';
import { seededRandom } from '../../utils/helpers';
import { getSize } from '../../constants/size';

export function sizeFreqModel(data: DrawRecord[], baseSeed: number): Record<string, number> {
  const sizes: Record<string, number> = { '大': 0, '小': 0 };
  const seed = baseSeed + 'size_freq'.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 3000;
  const rng = seededRandom(seed);
  const recent = data.slice(-50);
  recent.forEach((d, i) => {
    const size = getSize(d.special);
    sizes[size] += ((i + 1) / recent.length) * 0.8;
  });
  sizes['大'] += rng() * 0.1;
  sizes['小'] += rng() * 0.1;
  const total = sizes['大'] + sizes['小'];
  sizes['大'] = total > 0 ? sizes['大'] / total : 0.5;
  sizes['小'] = total > 0 ? sizes['小'] / total : 0.5;
  return sizes;
}

export function sizeAlternateModel(data: DrawRecord[], baseSeed: number): Record<string, number> {
  const sizes: Record<string, number> = { '大': 0, '小': 0 };
  const seed = baseSeed + 'size_alternate'.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 3000;
  const rng = seededRandom(seed);
  const recent = data.slice(-30);
  let lastSize = getSize(recent[0].special);
  let alternate = 0;
  for (let i = 1; i < recent.length; i++) {
    const currentSize = getSize(recent[i].special);
    if (currentSize !== lastSize) alternate++;
    lastSize = currentSize;
  }
  if (alternate / recent.length > 0.6) {
    sizes[lastSize === '大' ? '小' : '大'] += 0.3;
  }
  recent.forEach(d => {
    sizes[getSize(d.special)] += 0.2;
  });
  sizes['大'] += rng() * 0.1;
  sizes['小'] += rng() * 0.1;
  const total = sizes['大'] + sizes['小'];
  sizes['大'] = total > 0 ? sizes['大'] / total : 0.5;
  sizes['小'] = total > 0 ? sizes['小'] / total : 0.5;
  return sizes;
}

export const sizeModelFunctions: Record<string, (data: DrawRecord[], baseSeed: number) => Record<string, number>> = {
  size_freq: sizeFreqModel,
  size_alternate: sizeAlternateModel,
};

export const SIZE_MODELS = ['size_freq', 'size_alternate'];
