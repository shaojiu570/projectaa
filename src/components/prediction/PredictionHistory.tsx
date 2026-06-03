import NumberBall from '../NumberBall';

interface PredictionHistoryItem {
  time: string;
  top3: number[];
}

interface PredictionHistoryProps {
  history: PredictionHistoryItem[];
}

export default function PredictionHistory({ history }: PredictionHistoryProps) {
  if (history.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">📝 本次会话预测记录</h3>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {history.map((h, i) => (
          <div key={i} className="flex items-center gap-3 text-sm p-2 bg-gray-50 rounded-lg">
            <span className="text-gray-400 font-mono text-xs w-20">{h.time}</span>
            <span className="text-gray-500">Top-3:</span>
            <div className="flex gap-1">
              {h.top3.map(n => (
                <NumberBall key={n} number={n} size="sm" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
