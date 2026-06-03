import { ModelConfig } from '../../stores/ModelContext';

interface ModelPanelProps {
  models: ModelConfig[];
  enabledModels: ModelConfig[];
  totalWeight: number;
  onToggle: (id: string) => void;
  onWeightChange: (id: string, weight: number) => void;
}

export default function ModelPanel({
  models,
  enabledModels,
  totalWeight,
  onToggle,
  onWeightChange,
}: ModelPanelProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">🧠 模型选择与权重配置</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            勾选需要参与计算的模型，所有启用模型将同时参与融合计算
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full font-medium">
            已选 {enabledModels.length} / {models.length} 模型
          </span>
          {totalWeight > 0 && (
            <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full">
              总权重 {totalWeight.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {models.map(m => {
          const nw = m.enabled && totalWeight > 0 ? ((m.weight / totalWeight) * 100).toFixed(1) : '0.0';
          return (
            <div
              key={m.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                m.enabled
                  ? 'bg-indigo-50/60 border-indigo-200 shadow-sm'
                  : 'bg-gray-50 border-gray-200 opacity-70'
              }`}
            >
              <input
                type="checkbox"
                checked={m.enabled}
                onChange={() => onToggle(m.id)}
                className="w-4 h-4 text-indigo-600 rounded shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800 text-sm">{m.name}</span>
                  {m.enabled && (
                    <span className="text-xs px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded">
                      归一化 {nw}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate">{m.desc}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 w-36">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={m.weight}
                  onChange={e => onWeightChange(m.id, parseFloat(e.target.value))}
                  className="flex-1 h-1.5 accent-indigo-600"
                  disabled={!m.enabled}
                />
                <span className="text-xs font-mono text-gray-600 w-8 text-right">
                  {m.weight.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
