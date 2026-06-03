import { DrawRecord, ModelConfig } from '../data/types';
import { numberModelFunctions } from '../models/number';
import { zodiacModelFunctions } from '../models/zodiac';
import { getZodiac } from '../constants/zodiac';

export function calculateAdaptiveWeights(
  data: DrawRecord[],
  models: ModelConfig[],
  type: 'number' | 'zodiac'
): { id: string; weight: number }[] {
  if (models.length === 0 || data.length < 30) {
    return models.map(m => ({ id: m.id, weight: m.weight }));
  }

  const evalData = data.slice(-60);
  const windowSize = 15;
  const allScores: { id: string; scores: number[] }[] = models.map(m => ({ id: m.id, scores: [] }));

  for (let startIdx = 0; startIdx <= evalData.length - windowSize - 1; startIdx += 2) {
    const trainData = evalData.slice(startIdx, startIdx + windowSize);
    const testRecord = evalData[startIdx + windowSize];
    if (!testRecord) continue;

    for (const model of models) {
      let hit = false;
      const lastIssue = trainData[trainData.length - 1]?.issue || '0';
      const adaptSeed = lastIssue.split('').reduce((a: number, c: string) => a * 31 + c.charCodeAt(0), 0) & 0x7fffffff;
      if (type === 'number') {
        const probs = numberModelFunctions[model.id](trainData, adaptSeed);
        const top38 = probs.map((p, i) => ({ num: i + 1, p })).sort((a, b) => b.p - a.p).slice(0, 38).map(x => x.num);
        hit = top38.includes(testRecord.special);
      } else {
        const probs = zodiacModelFunctions[model.id](trainData, adaptSeed + 10000);
        const top9 = Object.entries(probs).sort((a, b) => b[1] - a[1]).slice(0, 9).map(x => x[0]);
        hit = top9.includes(getZodiac(testRecord.special));
      }
      const existing = allScores.find(s => s.id === model.id);
      if (existing) existing.scores.push(hit ? 1 : 0);
    }
  }

  const modelScores = allScores.map(m => {
    if (m.scores.length === 0) return { id: m.id, avgScore: 0.01 };
    const avg = m.scores.reduce((a, b) => a + b, 0) / m.scores.length;
    return { id: m.id, avgScore: Math.max(0.01, avg) };
  });

  const expScores = modelScores.map(m => ({ id: m.id, exp: Math.exp(m.avgScore * 5) }));
  const totalExp = expScores.reduce((s, m) => s + m.exp, 0);
  return expScores.map(m => ({ id: m.id, weight: m.exp / totalExp }));
}
