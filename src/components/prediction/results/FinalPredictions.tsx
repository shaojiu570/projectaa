import NumberBall from '../../NumberBall';
import { PredictionResult } from '../../utils/prediction';
import { calculateNextIssue, calculateNextDate } from '../../utils/nextIssueCalculator';

interface FinalPredictionsProps {
  result: PredictionResult;
  nextIssue?: string;
  nextDate?: string;
}

export default function FinalPredictions({ result }: FinalPredictionsProps) {
  return (
    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl shadow-lg p-6 text-white">
      <h3 className="text-xl font-bold mb-1">🎯 最终推荐号码</h3>
      <p className="text-indigo-200 text-sm mb-5">
        基于 {result.activeModelCount} 个模型融合推理，漏斗 4 级筛选输出
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {result.predictions.map(pred => (
          <div
            key={pred.number}
            className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/20"
          >
            <div className="text-xs text-indigo-200 mb-2">#{pred.rank}</div>
            <NumberBall number={pred.number} size="lg" highlight />
            <div className="mt-2 text-lg font-bold font-mono">{(pred.probability * 100).toFixed(2)}%</div>
            <div className="mt-1 space-y-0.5 text-xs text-indigo-200">
              <div>
                {pred.zodiac} · {pred.color}
              </div>
              <div>
                {pred.element} · {pred.number % 2 ? '奇' : '偶'} · {pred.number >= 25 ? '大' : '小'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
