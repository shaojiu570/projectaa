import { Info, RotateCcw } from 'lucide-react';
import { FunnelConfig } from '../../stores/FunnelContext';

interface FunnelPanelProps {
  config: FunnelConfig;
  onChange: React.Dispatch<React.SetStateAction<FunnelConfig>>;
  onReset: () => void;
}

function FunnelSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  display,
  hint,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  display: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-2 accent-indigo-600"
        disabled={disabled}
      />
      <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
    </div>
  );
}

export default function FunnelPanel({ config, onChange, onReset }: FunnelPanelProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">🔽 漏斗筛选参数</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            调整各层筛选参数，控制从49个号码逐步筛选到最终推荐数量
          </p>
        </div>
        <button
          onClick={onReset}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1 text-gray-600"
        >
          <RotateCcw className="w-3.5 h-3.5" /> 重置默认
        </button>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-4 flex items-start gap-2">
        <Info className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
        <p className="text-xs text-gray-600">
          49个号码 → L1-1全局剔除(保留{Math.round(49 * config.level1KeepRatio)}个)
          → L1-2生肖筛选(Top-{config.zodiacTopK}生肖)
          → L2加权保留({config.level2KeepCount}个)
          → L3最终排序(输出{config.level3OutputCount}个)
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <FunnelSlider
          label="L1-1 全局保留比例"
          value={config.level1KeepRatio}
          onChange={v => onChange(c => ({ ...c, level1KeepRatio: v }))}
          min={0.2}
          max={1}
          step={0.05}
          display={`${(config.level1KeepRatio * 100).toFixed(0)}% (${Math.round(49 * config.level1KeepRatio)}个)`}
          hint="保留概率最高的号码比例"
        />
        <FunnelSlider
          label="L1-2 生肖 Top-K"
          value={config.zodiacTopK}
          onChange={v => onChange(c => ({ ...c, zodiacTopK: Math.round(v) }))}
          min={1}
          max={12}
          step={1}
          display={`${config.zodiacTopK} 个生肖`}
          hint="保留概率最高的生肖数量"
        />
        <FunnelSlider
          label="L2 加权保留数"
          value={config.level2KeepCount}
          onChange={v => onChange(c => ({ ...c, level2KeepCount: Math.round(v) }))}
          min={3}
          max={40}
          step={1}
          display={`${config.level2KeepCount} 个号码`}
          hint="加权后保留的候选号码数"
        />
        <FunnelSlider
          label="L3 最终输出数"
          value={config.level3OutputCount}
          onChange={v => onChange(c => ({ ...c, level3OutputCount: Math.round(v) }))}
          min={1}
          max={30}
          step={1}
          display={`${config.level3OutputCount} 个号码`}
          hint="最终推荐的号码数量"
        />
        <FunnelSlider
          label="生肖融合 α"
          value={config.zodiacFusionAlpha}
          onChange={v => onChange(c => ({ ...c, zodiacFusionAlpha: v }))}
          min={0}
          max={1}
          step={0.05}
          display={`模型 ${(config.zodiacFusionAlpha * 100).toFixed(0)}% / 马尔可夫 ${((1 - config.zodiacFusionAlpha) * 100).toFixed(0)}%`}
          hint="生肖概率的融合权重分配"
          disabled={!config.useMarkovForZodiac}
        />
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
            <input
              type="checkbox"
              checked={config.useMarkovForZodiac}
              onChange={e => onChange(c => ({ ...c, useMarkovForZodiac: e.target.checked }))}
              className="w-4 h-4 text-indigo-600 rounded"
            />
            <div>
              <div className="text-sm font-medium text-gray-700">融合马尔可夫链</div>
              <div className="text-xs text-gray-400">生肖概率融合马尔可夫转移概率</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
