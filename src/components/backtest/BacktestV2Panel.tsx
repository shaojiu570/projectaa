/**
 * V2.0 回测面板
 * Walk-Forward 回测 UI
 */

import { useState, useCallback } from 'react';
import { useData } from '../../stores/DataContext';
import { useModelLibrary } from '../../stores/ModelLibraryContext';
import { PredictionTypeConfig } from '../../models/dynamic/types';
import {
  runWalkForwardBacktest,
  getDefaultBacktestConfig,
} from '../../engine/backtest/walkForward';
import { BacktestResultV2, BacktestConfig } from '../../engine/types';
import { X, Play, BarChart3, AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  types: PredictionTypeConfig[];
}

export default function BacktestV2Panel({ open, onClose, types }: Props) {
  const { data } = useData();
  const { algorithms } = useModelLibrary();

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ phase: 0, current: 0, total: 0 });
  const [result, setResult] = useState<BacktestResultV2 | null>(null);
  const [error, setError] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState<string>(
    types.find(t => t.enabled)?.id || '',
  );

  // 配置
  const [trainSize, setTrainSize] = useState(200);
  const [validationSize, setValidationSize] = useState(30);
  const [testSize, setTestSize] = useState(30);
  const [purgeGap, setPurgeGap] = useState(5);

  const handleRun = useCallback(async () => {
    const type = types.find(t => t.id === selectedTypeId);
    if (!type) { alert('请选择预测类型'); return; }
    if (data.length < trainSize + validationSize + testSize + purgeGap * 2) {
      alert(`数据不足，至少需要 ${trainSize + validationSize + testSize + purgeGap * 2} 期`);
      return;
    }

    setRunning(true);
    setError('');
    setResult(null);
    setProgress({ phase: 0, current: 0, total: 0 });

    try {
      const config: BacktestConfig = {
        ...getDefaultBacktestConfig(type.id),
        trainSize,
        validationSize,
        testSize,
        purgeGap,
      };

      const res = await runWalkForwardBacktest(
        data,
        type,
        algorithms,
        config,
        { onProgress: (phase: number, current: number, total: number) => setProgress({ phase, current, total }) },
      );

      setResult(res);
    } catch (e: any) {
      setError(e?.message || '回测失败');
    }

    setRunning(false);
  }, [data, types, algorithms, selectedTypeId, trainSize, validationSize, testSize, purgeGap]);

  if (!open) return null;

  const enabledTypes = types.filter(t => t.enabled);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            V2.0 Walk-Forward 回测
            <span className="text-xs text-gray-400 font-normal">多窗口滚动验证 + 基准对比 + 过拟合检测</span>
          </h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-xl">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* 配置区 */}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">预测类型</label>
              <select
                value={selectedTypeId}
                onChange={e => setSelectedTypeId(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm"
              >
                {enabledTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">训练窗口</label>
              <input type="number" min={50} max={500} value={trainSize}
                onChange={e => setTrainSize(Math.max(50, parseInt(e.target.value) || 200))}
                className="w-20 px-2 py-1.5 border border-gray-200 rounded-xl text-sm text-center" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">验证窗口</label>
              <input type="number" min={5} max={100} value={validationSize}
                onChange={e => setValidationSize(Math.max(5, parseInt(e.target.value) || 30))}
                className="w-20 px-2 py-1.5 border border-gray-200 rounded-xl text-sm text-center" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">测试窗口</label>
              <input type="number" min={5} max={100} value={testSize}
                onChange={e => setTestSize(Math.max(5, parseInt(e.target.value) || 30))}
                className="w-20 px-2 py-1.5 border border-gray-200 rounded-xl text-sm text-center" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Purge Gap</label>
              <input type="number" min={0} max={20} value={purgeGap}
                onChange={e => setPurgeGap(Math.max(0, parseInt(e.target.value) || 5))}
                className="w-20 px-2 py-1.5 border border-gray-200 rounded-xl text-sm text-center" />
            </div>
            <button onClick={handleRun} disabled={running}
              className="px-5 py-1.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5" /> {running ? '回测中...' : '开始 V2 回测'}
            </button>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            Walk-Forward：每个窗口独立训练→验证→测试，防止信息泄漏。包含 4 种 Baseline 对比、模型相关性分析、过拟合检测。
          </p>

          {/* 进度 */}
          {running && (
            <div className="py-4 text-center">
              <div className="text-sm text-gray-500 mb-2">
                {progress.phase === 0 && '数据验证...'}
                {progress.phase === 1 && `窗口训练 ${progress.current + 1}/${progress.total}...`}
                {progress.phase === 2 && `子集搜索 ${progress.current + 1}/${progress.total}...`}
                {progress.phase === 3 && `权重优化 ${progress.current + 1}/${progress.total}...`}
                {progress.phase === 4 && '汇总结果...'}
              </div>
              {progress.total > 0 && (
                <div className="w-full max-w-md mx-auto h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all duration-150"
                    style={{ width: `${Math.min(100, (progress.current / progress.total) * 100)}%` }} />
                </div>
              )}
            </div>
          )}

          {/* 错误 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}

          {/* 结果 */}
          {result && (
            <div className="space-y-4">
              {/* 概览 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-400 mb-1">Walk-Forward 窗口</div>
                  <div className="text-lg font-bold text-gray-800">{result.totalWindows}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-400 mb-1">Top5 命中率</div>
                  <div className="text-lg font-bold text-gray-800">
                    {(result.metrics.hitRate * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-400 mb-1">MRR</div>
                  <div className="text-lg font-bold text-gray-800">
                    {result.metrics.mrr.toFixed(3)}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-400 mb-1">稳定性</div>
                  <div className="text-lg font-bold text-gray-800">
                    {result.stability.stabilityScore.toFixed(3)}
                  </div>
                </div>
              </div>

              {/* 过拟合风险 */}
              <div className={`p-3 rounded-xl border ${
                result.overfit.riskLevel === 'high' ? 'bg-red-50 border-red-200' :
                result.overfit.riskLevel === 'medium' ? 'bg-amber-50 border-amber-200' :
                'bg-green-50 border-green-200'
              }`}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className={`w-4 h-4 ${
                    result.overfit.riskLevel === 'high' ? 'text-red-500' :
                    result.overfit.riskLevel === 'medium' ? 'text-amber-500' :
                    'text-green-500'
                  }`} />
                  过拟合风险：{result.overfit.riskLevel === 'high' ? '高' :
                    result.overfit.riskLevel === 'medium' ? '中' : '低'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  IS/OOS Gap: {result.overfit.isToOosGap.toFixed(3)} |
                  Ratio: {result.overfit.overfitRatio.toFixed(2)}
                </div>
              </div>

              {/* 选中模型 */}
              {result.selectedModels.length > 0 && (
                <div className="border border-gray-100 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">选中模型与权重</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.selectedModels.map(m => (
                      <span key={m.modelId} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg">
                        {m.modelId} {(m.weight * 100).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Baseline 对比 */}
              {result.baselineResults.length > 0 && (
                <div className="border border-gray-100 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Baseline 对比</h4>
                  <div className="text-xs space-y-1">
                    {result.baselineResults.map(b => (
                      <div key={b.baselineType} className="flex justify-between">
                        <span className="text-gray-500">{b.baselineType}</span>
                        <span className="font-mono">{(b.metrics.hitRate * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 窗口明细 */}
              {result.walkForwardResults.length > 0 && (
                <details className="border border-gray-100 rounded-xl p-4">
                  <summary className="text-sm font-semibold text-gray-700 cursor-pointer">
                    Walk-Forward 窗口明细（{result.walkForwardResults.length}）
                  </summary>
                  <div className="mt-2 space-y-2 max-h-60 overflow-y-auto text-xs">
                    {result.walkForwardResults.map(w => (
                      <div key={w.windowId} className="p-2 bg-gray-50 rounded-lg">
                        <div className="flex justify-between">
                          <span className="font-medium">{w.windowId}</span>
                          <span className="text-gray-500">
                            验证: {(w.validationMetrics.compositeScore * 100).toFixed(1)}% |
                            OOS: {(w.testMetrics.compositeScore * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-gray-400 mt-1">
                          模型: {w.selectedModels.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
