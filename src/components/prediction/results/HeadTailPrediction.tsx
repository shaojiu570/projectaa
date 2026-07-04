import { useState } from 'react';
import type { PredictionResult } from '../../utils/prediction';
// @ts-ignore: force side-effect to prevent tree-shaking
void (function(){});

interface HeadTailPredictionProps {
  result: PredictionResult;
}

const HEAD_LABELS: Record<string, string> = {
  '0': '0头 (1-9)',
  '1': '1头 (10-19)',
  '2': '2头 (20-29)',
  '3': '3头 (30-39)',
  '4': '4头 (40-49)',
};

function copyText(text: string, label: string) {
  navigator.clipboard.writeText(text);
}

function computeFromFused(fusedProbs: number[]): { heads: { label: string; probability: number; rank: number }[]; tails: { label: string; probability: number; rank: number }[] } {
  const headProbs: Record<string, number> = {};
  const tailProbs: Record<string, number> = {};
  for (let n = 1; n <= fusedProbs.length; n++) {
    const h = Math.floor((n - 1) / 10).toString();
    headProbs[h] = (headProbs[h] || 0) + fusedProbs[n - 1];
    const t = (n % 10).toString();
    tailProbs[t] = (tailProbs[t] || 0) + fusedProbs[n - 1];
  }
  const heads = Object.entries(headProbs).map(([label, probability]) => ({ label, probability, rank: 0 })).sort((a, b) => b.probability - a.probability).slice(0, 4).map((item, i) => ({ ...item, rank: i + 1 }));
  const tails = Object.entries(tailProbs).map(([label, probability]) => ({ label, probability, rank: 0 })).sort((a, b) => b.probability - a.probability).slice(0, 8).map((item, i) => ({ ...item, rank: i + 1 }));
  return { heads, tails };
}

export default function HeadTailPrediction({ result }: HeadTailPredictionProps) {
  const [copiedHead, setCopiedHead] = useState(false);
  const [copiedTail, setCopiedTail] = useState(false);

  let heads = result.headPredictions || [];
  let tails = result.tailPredictions || [];

  if (heads.length === 0 && tails.length === 0 && result.fusedProbs?.length === 49) {
    const computed = computeFromFused(result.fusedProbs);
    heads = computed.heads;
    tails = computed.tails;
  }

  if (heads.length === 0 && tails.length === 0) return null;

  const headText = heads.map(h => `${HEAD_LABELS[h.label] || h.label + '头'} ${(h.probability * 100).toFixed(1)}%`).join('\n');
  const tailText = tails.map(t => `${t.label}尾 ${(t.probability * 100).toFixed(1)}%`).join('\n');

  const handleCopyHead = () => {
    copyText(headText, '头数');
    setCopiedHead(true);
    setTimeout(() => setCopiedHead(false), 1500);
  };

  const handleCopyTail = () => {
    copyText(tailText, '尾数');
    setCopiedTail(true);
    setTimeout(() => setCopiedTail(false), 1500);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-800">头数预测 Top 4</h4>
          <button
            onClick={handleCopyHead}
            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            {copiedHead ? '已复制' : '复制'}
          </button>
        </div>
        <div className="space-y-2">
          {heads.map(item => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                {item.rank}
              </span>
              <span className="text-sm text-gray-700 font-medium">
                {HEAD_LABELS[item.label] || `${item.label}头`}
              </span>
              <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${Math.max(item.probability * 100, 3)}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 font-mono w-14 text-right select-all">
                {(item.probability * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-800">尾数预测 Top 8</h4>
          <button
            onClick={handleCopyTail}
            className="text-xs text-pink-600 hover:text-pink-800 flex items-center gap-1"
          >
            {copiedTail ? '已复制' : '复制'}
          </button>
        </div>
        <div className="space-y-1.5">
          {tails.map(item => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-pink-100 text-pink-700 text-xs font-bold flex items-center justify-center shrink-0">
                {item.rank}
              </span>
              <span className="text-sm text-gray-700 font-medium w-12">
                {item.label}尾
              </span>
              <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-pink-500 rounded-full"
                  style={{ width: `${Math.max(item.probability * 100, 3)}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 font-mono w-14 text-right select-all">
                {(item.probability * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
