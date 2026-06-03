import NumberBall from '../../NumberBall';
import { PredictionResult } from '../../utils/prediction';

interface ModelContributionProps {
  result: PredictionResult;
}

export default function ModelContribution({ result }: ModelContributionProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">📊 模型贡献度</h3>
      <div className="flex gap-2 flex-wrap">
        {result.modelOutputs.map(o => (
          <div
            key={o.modelId}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-100"
          >
            <span className="text-sm font-medium text-gray-800">{o.modelName}</span>
            <div className="w-20 bg-gray-200 rounded-full h-2">
              <div
                className="h-full bg-indigo-500 rounded-full"
                style={{ width: `${o.normalizedWeight * 100}%` }}
              />
            </div>
            <span className="text-xs font-mono text-indigo-700">{(o.normalizedWeight * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
