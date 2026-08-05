import { DrawRecord } from '../data/types';
import { getColor, getParity, getSize, getElement, ZODIACS } from '../constants';
import { getZodiacByNumber } from './lunarCalendar';

export type StateGroup = '生肖' | '波色' | '大小' | '奇偶' | '五行';

export interface MarkovResult {
  stateGroup: StateGroup;
  states: string[];
  transitionMatrix: number[][];
  currentState: string;
  predictions: { state: string; probability: number }[];
  chiSquare: number;
  isMarkov: boolean;
}

function getStateMapping(group: StateGroup): (d: DrawRecord) => string {
  switch (group) {
    case '生肖': return (d) => getZodiacByNumber(new Date(d.date), d.special);
    case '波色': return (d) => getColor(d.special);
    case '大小': return (d) => getSize(d.special);
    case '奇偶': return (d) => getParity(d.special);
    case '五行': return (d) => getElement(d.special, new Date(d.date).getFullYear());
  }
}

function getStates(group: StateGroup): string[] {
  switch (group) {
    case '生肖': return [...ZODIACS];
    case '波色': return ['红波', '蓝波', '绿波'];
    case '大小': return ['大', '小'];
    case '奇偶': return ['奇', '偶'];
    case '五行': return ['金', '木', '水', '火', '土'];
  }
}

export function computeMarkov(data: DrawRecord[], group: StateGroup): MarkovResult {
  const mapper = getStateMapping(group);
  const states = getStates(group);
  const stateIdx = new Map(states.map((s, i) => [s, i]));
  const n = states.length;

  const freq: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const sequence = data.map(d => mapper(d));

  for (let i = 0; i < sequence.length - 1; i++) {
    const from = stateIdx.get(sequence[i]);
    const to = stateIdx.get(sequence[i + 1]);
    if (from !== undefined && to !== undefined) {
      freq[from][to]++;
    }
  }

  const matrix: number[][] = freq.map(row => {
    const sum = row.reduce((a, b) => a + b, 0);
    return sum > 0 ? row.map(v => v / sum) : row.map(() => 1 / n);
  });

  const total = freq.flat().reduce((a, b) => a + b, 0);
  const marginal = states.map((_, j) => {
    const colSum = freq.reduce((sum, row) => sum + row[j], 0);
    return colSum / (total || 1);
  });

  let chiSquare = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (freq[i][j] > 0 && matrix[i][j] > 0 && marginal[j] > 0) {
        chiSquare += 2 * freq[i][j] * Math.log(matrix[i][j] / marginal[j]);
      }
    }
  }

  const df = (n - 1) * (n - 1);
  const criticalValue = df + 2 * Math.sqrt(df);
  const isMarkov = chiSquare > criticalValue;

  const currentState = sequence[sequence.length - 1];
  const currentIdx = stateIdx.get(currentState) ?? 0;
  const predictions = states.map((state, j) => ({
    state,
    probability: matrix[currentIdx][j],
  })).sort((a, b) => b.probability - a.probability);

  return {
    stateGroup: group,
    states,
    transitionMatrix: matrix,
    currentState,
    predictions,
    chiSquare,
    isMarkov,
  };
}

export function computeAllMarkov(data: DrawRecord[]): MarkovResult[] {
  const groups: StateGroup[] = ['生肖', '波色', '大小', '奇偶', '五行'];
  return groups.map(g => computeMarkov(data, g));
}
