import { useState, useEffect, useCallback } from 'react';
import { useData } from '../stores/DataContext';
import { useSeparatedModel } from '../stores/SeparatedModelContext';
import { runSeparatedPrediction } from '../engine';
import { SeparatedPredictionResult } from '../data/types';
import { calculateNextIssue, calculateNextDate } from '../utils/nextIssueCalculator';
import { Play, Settings2, TrendingUp, Zap, Trash2 } from 'lucide-react';
import NumberBall from './NumberBall';

interface SavedSeparatedPrediction {
  time: string;
  result: SeparatedPredictionResult;
  enabledNumberModelIds: string[];
  enabledZodiacModelIds: string[];
  trainLastIssue: string;
  predictIssue: string;
  predictDate: string;
  // 直接保存第一层结果，回测时无需重新计算，100%保证一致
  level1Numbers: number[];
  level1Zodiacs: string[];
}

const SEPARATED_PREDICTION_KEY = 'lottery_separated_prediction_result';
const MAX_SAVED_RESULTS = 10;

function SeparatedPrediction() {
  const { data } = useData();
  const { 
    numberModels, 
    zodiacModels, 
    toggleNumberModel, 
    toggleZodiacModel, 
    setNumberModelWeight, 
    setZodiacModelWeight,
    autoWeightOptimization,
    setAutoWeightOptimization,
    resetSeparatedModels,
  } = useSeparatedModel();

  // 加载保存的预测结果
  const [savedPredictions, setSavedPredictions] = useState<SavedSeparatedPrediction[]>(() => {
    const saved = localStorage.getItem(SEPARATED_PREDICTION_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // 当前显示的结果
  const result = savedPredictions[currentIndex]?.result ?? null;

  // 计算预测期数
  const nextIssue = data.length > 0 ? calculateNextIssue(data[data.length - 1]) : '';
  const nextDate = data.length > 0 ? calculateNextDate(data[data.length - 1].date) : '';

  // 持久化预测结果
  useEffect(() => {
    localStorage.setItem(SEPARATED_PREDICTION_KEY, JSON.stringify(savedPredictions));
  }, [savedPredictions]);

  const runPredict = useCallback(() => {
    const enabledNumberModels = numberModels.filter(m => m.enabled);
    const enabledZodiacModels = zodiacModels.filter(m => m.enabled);
    
    if (enabledNumberModels.length === 0 && enabledZodiacModels.length === 0) {
      alert('请至少启用一个号码或生肖模型');
      return;
    }

    setLoading(true);
    
    setTimeout(() => {
      const predictionResult = runSeparatedPrediction(
        data, 
        enabledNumberModels, 
        enabledZodiacModels,
        autoWeightOptimization
      );
      
      // 保存新的预测结果
      const newPrediction: SavedSeparatedPrediction = {
        time: new Date().toLocaleString(),
        result: predictionResult,
        enabledNumberModelIds: enabledNumberModels.map(m => m.id),
        enabledZodiacModelIds: enabledZodiacModels.map(m => m.id),
        trainLastIssue: data[data.length - 1]?.issue || '',
        predictIssue: calculateNextIssue(data[data.length - 1]),
        predictDate: calculateNextDate(data[data.length - 1].date),
        // 直接快照第一层，回测时直接用，不重新计算
        level1Numbers: predictionResult.numberPredictions.level1.map((p: any) => p.number),
        level1Zodiacs: predictionResult.zodiacPredictions.level1.map((p: any) => p.zodiac),
      };
      
      setSavedPredictions(prev => {
        const updated = [newPrediction, ...prev].slice(0, MAX_SAVED_RESULTS);
        return updated;
      });
      setCurrentIndex(0); // 显示最新的结果
      setLoading(false);
    }, 800);
  }, [data, numberModels, zodiacModels]);

  const clearHistory = () => {
    if (confirm('确定要清空所有预测历史吗？')) {
      setSavedPredictions([]);
      setCurrentIndex(0);
    }
  };

  const deletePrediction = (index: number) => {
    if (confirm('确定要删除这条预测记录吗？')) {
      setSavedPredictions(prev => {
        const updated = prev.filter((_, i) => i !== index);
        if (currentIndex >= updated.length && updated.length > 0) {
          setCurrentIndex(updated.length - 1);
        } else if (updated.length === 0) {
          setCurrentIndex(0);
        }
        return updated;
      });
    }
  };

  const navigatePrediction = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else if (direction === 'next' && currentIndex < savedPredictions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  return (
    <div className="space-y-4">
      {/* 控制面板 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            分离预测模型
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <Settings2 className="w-4 h-4" />
              模型设置
            </button>
            <button
              onClick={runPredict}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  预测中...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  开始预测
                </>
              )}
            </button>
          </div>
        </div>

        {/* 历史记录导航 */}
        {savedPredictions.length > 0 && (
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
            <button
              onClick={() => navigatePrediction('prev')}
              disabled={currentIndex === 0}
              className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一条
            </button>
            <div className="text-center">
              <div className="text-sm text-gray-600">
                {currentIndex + 1} / {savedPredictions.length} · {savedPredictions[currentIndex]?.time}
              </div>
              {savedPredictions[currentIndex]?.trainLastIssue && (
                <div className="text-xs text-indigo-600 font-medium mt-0.5">
                  基于第{savedPredictions[currentIndex].trainLastIssue.slice(-3)}期 → 预测第{savedPredictions[currentIndex].predictIssue.slice(-3)}期 ({savedPredictions[currentIndex].predictDate})
                </div>
              )}
            </div>
            <button
              onClick={() => navigatePrediction('next')}
              disabled={currentIndex === savedPredictions.length - 1}
              className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一条
            </button>
            <button
              onClick={() => deletePrediction(currentIndex)}
              className="px-2 py-1 text-red-500 hover:bg-red-50 rounded border border-red-200 hover:text-red-700"
              title="删除本条预测"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 模型设置面板 */}
      {showSettings && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 号码模型设置 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                号码预测模型
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {numberModels.map(model => (
                  <div key={model.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                    <input
                      type="checkbox"
                      checked={model.enabled}
                      onChange={() => toggleNumberModel(model.id)}
                      className="w-4 h-4 text-indigo-600 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-800 text-sm truncate">{model.name}</div>
                      <div className="text-xs text-gray-400 truncate">{model.desc}</div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.05"
                        value={model.weight}
                        onChange={(e) => setNumberModelWeight(model.id, parseFloat(e.target.value))}
                        className="w-12 px-1 py-0.5 border border-gray-200 rounded text-xs text-center"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 生肖模型设置 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                生肖预测模型
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {zodiacModels.map(model => (
                  <div key={model.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                    <input
                      type="checkbox"
                      checked={model.enabled}
                      onChange={() => toggleZodiacModel(model.id)}
                      className="w-4 h-4 text-indigo-600 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-800 text-sm truncate">{model.name}</div>
                      <div className="text-xs text-gray-400 truncate">{model.desc}</div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.05"
                        value={model.weight}
                        onChange={(e) => setZodiacModelWeight(model.id, parseFloat(e.target.value))}
                        className="w-12 px-1 py-0.5 border border-gray-200 rounded text-xs text-center"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoWeightOptimization}
                onChange={(e) => setAutoWeightOptimization(e.target.checked)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm font-medium text-gray-700">启用自动权重优化</span>
              <span className="text-xs text-gray-500">（每次预测时根据模型表现自动调整权重）</span>
            </label>
          </div>

          <div className="mt-4 flex justify-between">
            <button
              onClick={resetSeparatedModels}
              className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              重置为默认
            </button>
            <button
              onClick={clearHistory}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              清空历史
            </button>
          </div>
        </div>
      )}

{/* 预测结果展示 - 只显示第一层 */}
      {result && result.numberPredictions && (() => {
        const predIssue = savedPredictions[currentIndex]?.predictIssue?.slice(-3) || nextIssue.slice(-3);
        const trainIssue = savedPredictions[currentIndex]?.trainLastIssue?.slice(-3) || '';
        const predDate = savedPredictions[currentIndex]?.predictDate || nextDate;
        const level1Numbers = (result.numberPredictions.level1 || []).map((p: any) => p.number);
        const level1Zodiacs = (result.zodiacPredictions.level1 || []).map((p: any) => p.zodiac);
        const combos = result.combinedRecommendations?.combos || [];

        // 生成可复制的文本
        const copyText = [
          `【六合彩预测】第${predIssue}期 (${predDate})`,
          `基于第${trainIssue}期数据`,
          ``,
          `📊 号码第一层（${level1Numbers.length}个）：`,
          level1Numbers.map((n: number) => String(n).padStart(2, '0')).join(' '),
          ``,
          `🐲 生肖第一层（${level1Zodiacs.length}个）：`,
          level1Zodiacs.join(' '),
          ``,
          `🎯 综合推荐：`,
          ...combos.map((c: any, i: number) => `推荐${i + 1}：${c.zodiac} + ${String(c.number).padStart(2, '0')}`),
        ].join('\n');

        const handleCopy = () => {
          navigator.clipboard.writeText(copyText).then(() => {
            alert('已复制到剪贴板');
          }).catch(() => {
            // 降级方案
            const ta = document.createElement('textarea');
            ta.value = copyText;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            alert('已复制到剪贴板');
          });
        };

        const handleExport = () => {
          const blob = new Blob([copyText], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `预测第${predIssue}期_${predDate}.txt`;
          a.click();
          URL.revokeObjectURL(url);
        };

        return (
          <div className="space-y-4">
            {/* 标题栏 + 操作按钮 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-lg font-bold text-gray-800">
                    第{predIssue}期预测结果
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    基于第{trainIssue}期数据 · {predDate} · {result.activeModelCount}个模型
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                  >
                    📋 复制
                  </button>
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                  >
                    💾 导出
                  </button>
                </div>
              </div>
            </div>

            {/* 号码 + 生肖并排 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 号码第一层 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">
                    📊 号码第一层
                    <span className="ml-2 text-sm font-normal text-gray-500">{level1Numbers.length}个</span>
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(result.numberPredictions.level1 || []).map((pred: any) => (
                    <div key={pred.number} className="flex flex-col items-center">
                      <NumberBall number={pred.number} size="md" />
                      <span className="text-xs text-gray-400 mt-1">{(pred.probability * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 生肖第一层 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">
                    🐲 生肖第一层
                    <span className="ml-2 text-sm font-normal text-gray-500">{level1Zodiacs.length}个</span>
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(result.zodiacPredictions.level1 || []).map((pred: any) => (
                    <div key={pred.zodiac} className="flex flex-col items-center p-2 bg-indigo-50 rounded-lg min-w-[52px]">
                      <div className="w-9 h-9 flex items-center justify-center bg-indigo-500 text-white rounded-full font-bold text-base">
                        {pred.zodiac}
                      </div>
                      <span className="text-xs text-gray-500 mt-1">{(pred.probability * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 综合推荐 */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-5 text-white">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold">🎯 综合推荐</h3>
                <span className="text-sm opacity-80">第{predIssue}期 · {predDate}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {combos.map((combo: any, index: number) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-white/20 rounded-lg">
                    <span className="text-sm font-bold opacity-80">推荐{index + 1}</span>
                    <div className="w-10 h-10 flex items-center justify-center bg-green-400 rounded-full font-bold text-lg">
                      {combo.zodiac}
                    </div>
                    <span className="text-xl font-bold">+</span>
                    <div className="w-10 h-10 flex items-center justify-center bg-red-400 rounded-full font-bold text-base">
                      {String(combo.number).padStart(2, '0')}
                    </div>
                    <span className="text-xs opacity-70 ml-auto">{((combo.probability || 0) * 100).toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 预览文本（可直接选中复制） */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">文本预览（可直接选中复制）</span>
                <button onClick={handleCopy} className="text-xs text-indigo-600 hover:underline">一键复制</button>
              </div>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed select-all">
                {copyText}
              </pre>
            </div>
          </div>
        );
      })()}

      {/* 回测面板已移除 */}
    </div>
  );
}

export default SeparatedPrediction;
