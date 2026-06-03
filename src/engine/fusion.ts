import { DrawRecord, ModelConfig, SeparatedPredictionResult } from '../data/types';
import { numberModelFunctions } from '../models/number';
import { zodiacModelFunctions } from '../models/zodiac';
import { colorModelFunctions, COLOR_MODELS } from '../models/color';
import { sizeModelFunctions, SIZE_MODELS } from '../models/size';
import { parityModelFunctions, PARITY_MODELS } from '../models/parity';
import { calculateAdaptiveWeights } from './weights';
import { calculateDynamicLevels } from './funnel';

export function runSeparatedPrediction(
  data: DrawRecord[],
  numberModels: ModelConfig[],
  zodiacModels: ModelConfig[],
  autoWeightOptimization: boolean = true,
): SeparatedPredictionResult {
  const enabledNumberModels = numberModels.filter(m => m.enabled);
  const enabledZodiacModels = zodiacModels.filter(m => m.enabled);

  if (enabledNumberModels.length === 0 && enabledZodiacModels.length === 0) {
    return {
      numberPredictions: { level1: [], level2: [], level3: [] },
      zodiacPredictions: { level1: [], level2: [], level3: [] },
      colorPredictions: { level1: [], level2: [] },
      sizePredictions: { level1: [], level2: [] },
      parityPredictions: { level1: [], level2: [] },
      combinedRecommendations: { combos: [], colors: [], size: null, parity: null },
      timestamp: new Date().toISOString(),
      activeModelCount: 0,
      usedNumberWeights: [],
      usedZodiacWeights: [],
    };
  }

  const lastIssue = data[data.length - 1]?.issue || '0';
  const baseSeed = lastIssue.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0) & 0x7fffffff;

  let numberPredictions = { level1: [], level2: [], level3: [] } as any;
  let usedNumberWeights: { id: string; weight: number }[] = [];
  let usedZodiacWeights: { id: string; weight: number }[] = [];

  if (enabledNumberModels.length > 0) {
    const rawWeights = autoWeightOptimization
      ? calculateAdaptiveWeights(data, enabledNumberModels, 'number')
      : enabledNumberModels.map(m => ({ id: m.id, weight: m.weight }));
    const numberTotalWeight = rawWeights.reduce((s, m) => s + m.weight, 0);
    usedNumberWeights = rawWeights.map(w => ({
      id: w.id,
      weight: numberTotalWeight > 0 ? w.weight / numberTotalWeight : 1 / enabledNumberModels.length,
    }));

    const numberOutputs = enabledNumberModels.map(m => ({
      modelId: m.id,
      probs: numberModelFunctions[m.id](data, baseSeed),
      weight: usedNumberWeights.find(w => w.id === m.id)?.weight || 0,
    }));

    const fusedNumberProbs = new Array(49).fill(0);
    numberOutputs.forEach(output => {
      for (let i = 0; i < 49; i++) {
        fusedNumberProbs[i] += output.weight * output.probs[i];
      }
    });

    const numberCandidates = Array.from({ length: 49 }, (_, i) => i + 1)
      .map(num => ({ number: num, probability: fusedNumberProbs[num - 1] }))
      .sort((a, b) => b.probability - a.probability);

    const dynamicLevels = calculateDynamicLevels();
    numberPredictions = {
      level1: numberCandidates.slice(0, dynamicLevels.level1).map((pred, index) => ({ ...pred, rank: index + 1 })),
      level2: numberCandidates.slice(0, dynamicLevels.level2).map((pred, index) => ({ ...pred, rank: index + 1 })),
      level3: numberCandidates.slice(0, dynamicLevels.level3).map((pred, index) => ({ ...pred, rank: index + 1 })),
    };
  }

  let zodiacPredictions = { level1: [], level2: [], level3: [] } as any;
  if (enabledZodiacModels.length > 0) {
    const rawZodiacWeights = autoWeightOptimization
      ? calculateAdaptiveWeights(data, enabledZodiacModels, 'zodiac')
      : enabledZodiacModels.map(m => ({ id: m.id, weight: m.weight }));
    const zodiacTotalWeight = rawZodiacWeights.reduce((s, m) => s + m.weight, 0);
    usedZodiacWeights = rawZodiacWeights.map(w => ({
      id: w.id,
      weight: zodiacTotalWeight > 0 ? w.weight / zodiacTotalWeight : 1 / enabledZodiacModels.length,
    }));

    const zodiacOutputs = enabledZodiacModels.map(m => ({
      modelId: m.id,
      probs: zodiacModelFunctions[m.id](data, baseSeed + 10000),
      weight: usedZodiacWeights.find(w => w.id === m.id)?.weight || 0,
    }));

    const zodiacs = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
    const fusedZodiacProbs: Record<string, number> = {};
    zodiacs.forEach(z => fusedZodiacProbs[z] = 0);

    zodiacOutputs.forEach(output => {
      Object.entries(output.probs).forEach(([zodiac, prob]) => {
        fusedZodiacProbs[zodiac] += output.weight * prob;
      });
    });

    const zodiacCandidates = zodiacs
      .map(zodiac => ({
        zodiac,
        probability: fusedZodiacProbs[zodiac] || 0,
      }))
      .sort((a, b) => b.probability - a.probability);

    zodiacPredictions = {
      level1: zodiacCandidates.slice(0, 9).map((pred, index) => ({ ...pred, rank: index + 1 })),
      level2: zodiacCandidates.slice(0, 6).map((pred, index) => ({ ...pred, rank: index + 1 })),
      level3: zodiacCandidates.slice(0, 3).map((pred, index) => ({ ...pred, rank: index + 1 })),
    };
  }

  let colorPredictions = { level1: [], level2: [] } as any;
  const colorOutputs = COLOR_MODELS.map(id => ({
    probs: colorModelFunctions[id](data, baseSeed + 2000),
    weight: 1 / 3,
  }));
  const fusedColorProbs: Record<string, number> = {};
  ['红', '蓝', '绿'].forEach(c => fusedColorProbs[c] = 0);
  colorOutputs.forEach(output => {
    Object.entries(output.probs).forEach(([color, prob]) => {
      fusedColorProbs[color] += output.weight * prob;
    });
  });
  const colorCandidates = ['红', '蓝', '绿']
    .map(color => ({ color, probability: fusedColorProbs[color] }))
    .sort((a, b) => b.probability - a.probability);
  colorPredictions = {
    level1: colorCandidates.slice(0, 2).map((pred, index) => ({ ...pred, rank: index + 1 })),
    level2: colorCandidates.slice(0, 1).map((pred, index) => ({ ...pred, rank: index + 1 })),
  };

  let sizePredictions = { level1: [], level2: [] } as any;
  const sizeOutputs = SIZE_MODELS.map(id => ({
    probs: sizeModelFunctions[id](data, baseSeed + 3000),
    weight: 1 / 2,
  }));
  const fusedSizeProbs: Record<string, number> = {};
  sizeOutputs.forEach(output => {
    Object.entries(output.probs).forEach(([size, prob]) => {
      fusedSizeProbs[size] = (fusedSizeProbs[size] || 0) + output.weight * prob;
    });
  });
  const sizeCandidates = ['大', '小']
    .map(size => ({ size: size as '大' | '小', probability: fusedSizeProbs[size] || 0.5 }))
    .sort((a, b) => b.probability - a.probability);
  sizePredictions = {
    level1: sizeCandidates.map((pred, index) => ({ ...pred, rank: index + 1 })),
    level2: sizeCandidates.slice(0, 1).map((pred, index) => ({ ...pred, rank: index + 1 })),
  };

  let parityPredictions = { level1: [], level2: [] } as any;
  const parityOutputs = PARITY_MODELS.map(id => ({
    probs: parityModelFunctions[id](data, baseSeed + 4000),
    weight: 1 / 2,
  }));
  const fusedParityProbs: Record<string, number> = {};
  parityOutputs.forEach(output => {
    Object.entries(output.probs).forEach(([parity, prob]) => {
      fusedParityProbs[parity] = (fusedParityProbs[parity] || 0) + output.weight * prob;
    });
  });
  const parityCandidates = ['单', '双']
    .map(parity => ({ parity: parity as '单' | '双', probability: fusedParityProbs[parity] || 0.5 }))
    .sort((a, b) => b.probability - a.probability);
  parityPredictions = {
    level1: parityCandidates.map((pred, index) => ({ ...pred, rank: index + 1 })),
    level2: parityCandidates.slice(0, 1).map((pred, index) => ({ ...pred, rank: index + 1 })),
  };

  const topZodiacs = zodiacPredictions.level3.slice(0, 3).map((p: any) => p);
  const topNumbers = numberPredictions.level3.slice(0, 5).map((p: any) => p);

  const combos: { zodiac: string; number: number; probability: number }[] = [];
  for (const z of topZodiacs) {
    for (const n of topNumbers) {
      const comboProb = z.probability * n.probability;
      combos.push({
        zodiac: z.zodiac,
        number: n.number,
        probability: comboProb,
      });
    }
  }

  combos.sort((a, b) => b.probability - a.probability);
  const topCombos = combos.slice(0, 2);

  const topColor = colorPredictions.level2[0]?.color || '红';
  const topSize = sizePredictions.level2[0]?.size || '大';
  const topParity = parityPredictions.level2[0]?.parity || '单';

  const combinedRecommendations = {
    combos: topCombos,
    colors: [topColor],
    size: topSize,
    parity: topParity,
  };

  return {
    numberPredictions,
    zodiacPredictions,
    colorPredictions,
    sizePredictions,
    parityPredictions,
    combinedRecommendations,
    timestamp: new Date().toISOString(),
    activeModelCount: enabledNumberModels.length + enabledZodiacModels.length,
    usedNumberWeights,
    usedZodiacWeights,
  };
}
