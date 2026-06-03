import NumberBall from '../../NumberBall';
import { PredictionResult } from '../../utils/prediction';

interface ProbabilityDistributionProps {
  result: PredictionResult;
}

export default function ProbabilityDistribution({ result }: ProbabilityDistributionProps) {
  const maxProb = Math.max(...result.fusedProbs);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 全号码概率分布</h3>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 49 }, (_, i) => i + 1).map(n => {
          const prob = result.fusedProbs[n - 1];
          const intensity = prob / maxProb;
          const isPredicted = result.predictions.some(p => p.number === n);
          return (
            <div
              key={n}
              className={`relative rounded-lg p-2 text-center transition-all ${isPredicted ? 'ring-2 ring-indigo-500 shadow-md' : ''}`}
              style={{ backgroundColor: `rgba(99, 102, 241, ${intensity * 0.3})` }}
            >
              <NumberBall number={n} size="sm" />
              <div className="text-[10px] text-gray-500 mt-1 font-mono">{(prob * 100).toFixed(1)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
