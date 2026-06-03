import NumberBall from '../../NumberBall';
import { PredictionResult } from '../../utils/prediction';

interface FunnelVisualizationProps {
  result: PredictionResult;
}

export default function FunnelVisualization({ result }: FunnelVisualizationProps) {
  const colors = ['#6366f1,#818cf8', '#8b5cf6,#a78bfa', '#ec4899,#f472b6', '#f59e0b,#fbbf24'];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">🔽 漏斗筛选过程</h3>
      <div className="space-y-3">
        {result.funnelStages.map((stage, idx) => {
          const widthPct = (stage.outputCount / 49) * 100;
          return (
            <div key={idx}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">{stage.name}</span>
                <span className="text-gray-500">
                  {stage.inputCount} → <b className="text-indigo-600">{stage.outputCount}</b> 个号码
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-8 overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-700 flex items-center justify-center text-white text-xs font-medium"
                  style={{
                    width: `${Math.max(widthPct, 8)}%`,
                    background: `linear-gradient(90deg, ${colors[idx] || colors[0]})`,
                  }}
                >
                  {stage.outputCount}个
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{stage.description}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {stage.candidates.map(n => (
                  <NumberBall key={n} number={n} size="sm" />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
