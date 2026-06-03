import { useState, useCallback, useEffect } from 'react';
import React from 'react';
import { useData } from '../stores/DataContext';
import { useModel } from '../stores/ModelContext';
import { useFunnel, DEFAULT_FUNNEL } from '../stores/FunnelContext';
import { useMapping } from '../stores/MappingContext';
import { runMultiModelPrediction, PredictionResult } from '../utils/prediction';
import { calculateNextIssue, calculateNextDate } from '../utils/nextIssueCalculator';
import { Play, ChevronDown, ChevronUp, Settings2, SlidersHorizontal, Trash2 } from 'lucide-react';
import ModelPanel from './prediction/ModelPanel';
import FunnelPanel from './prediction/FunnelPanel';
import PredictionHistory from './prediction/PredictionHistory';
import {
  ModelContribution,
  FunnelVisualization,
  ZodiacProbabilities,
  FinalPredictions,
  ProbabilityDistribution,
  AttrCard,
  summarize,
} from './prediction/results';

import { saveToStorage, loadFromStorage } from '../utils/storage';

const PREDICTION_RESULT_KEY = 'lottery_prediction_result_v2';
const MAX_SAVED_RESULTS = 10;

interface SavedPrediction {
  time: string;
  result: PredictionResult;
  funnelConfig: typeof DEFAULT_FUNNEL;
  enabledModelIds: string[];
}

function Prediction() {
  const { data } = useData();
  const { models, toggleModel, setModelWeight } = useModel();
  const { funnelConfig, setFunnelConfig } = useFunnel();
  const { zodiacNumbers, getZodiac, getColor, getElement } = useMapping();

  const [savedPredictions, setSavedPredictions] = useState<SavedPrediction[]>(() => {
    const saved = loadFromStorage<SavedPrediction[]>(PREDICTION_RESULT_KEY);
    return saved ?? [];
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ time: string; top3: number[] }[]>([]);
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [showFunnelSettings, setShowFunnelSettings] = useState(false);

  useEffect(() => {
    saveToStorage(savedPredictions, PREDICTION_RESULT_KEY);
  }, [savedPredictions]);

  const result = savedPredictions[currentIndex]?.result ?? null;

  const nextIssue = data.length > 0 ? calculateNextIssue(data[data.length - 1]) : '';
  const nextDate = data.length > 0 ? calculateNextDate(data[data.length - 1].date) : '';

  const enabledModels = models.filter(m => m.enabled);
  const totalWeight = enabledModels.reduce((s, m) => s + m.weight, 0);

  const runPredict = useCallback(() => {
    if (enabledModels.length === 0) return;
    setLoading(true);
    setTimeout(() => {
      const res = runMultiModelPrediction(data, models, funnelConfig, zodiacNumbers, getZodiac, getColor, getElement);

      const newPrediction: SavedPrediction = {
        time: new Date().toLocaleString(),
        result: res,
        funnelConfig: { ...funnelConfig },
        enabledModelIds: enabledModels.map(m => m.id),
      };

      setSavedPredictions(prev => {
        const updated = [newPrediction, ...prev].slice(0, MAX_SAVED_RESULTS);
        return updated;
      });
      setCurrentIndex(0);

      setHistory(prev => [
        { time: new Date().toLocaleTimeString(), top3: res.predictions.slice(0, 3).map(p => p.number) },
        ...prev.slice(0, 19),
      ]);
      setLoading(false);
    }, 600);
  }, [data, models, funnelConfig, zodiacNumbers, getZodiac, getColor, getElement, enabledModels.length]);

  const resetFunnel = () => setFunnelConfig({ ...DEFAULT_FUNNEL });

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowModelSettings(!showModelSettings)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-indigo-600" />
            <span className="font-medium text-gray-800">模型配置</span>
            <span className="text-xs text-gray-500">({enabledModels.length}/{models.length} 个启用)</span>
          </div>
          {showModelSettings ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {showModelSettings && (
          <div className="px-4 pb-4">
            <ModelPanel
              models={models}
              enabledModels={enabledModels}
              totalWeight={totalWeight}
              onToggle={toggleModel}
              onWeightChange={setModelWeight}
            />
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowFunnelSettings(!showFunnelSettings)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            <span className="font-medium text-gray-800">漏斗参数</span>
            <span className="text-xs text-gray-500">(输出 {funnelConfig.level3OutputCount} 个)</span>
          </div>
          {showFunnelSettings ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {showFunnelSettings && (
          <div className="px-4 pb-4">
            <FunnelPanel config={funnelConfig} onChange={setFunnelConfig} onReset={resetFunnel} />
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <button
          onClick={runPredict}
          disabled={loading || enabledModels.length === 0}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-10 py-3 rounded-xl flex items-center gap-3 transition-all shadow-lg text-lg font-medium"
        >
          <Play className="w-5 h-5" />
          {loading ? '推理计算中...' : enabledModels.length === 0 ? '请至少选择一个模型' : `使用 ${enabledModels.length} 个模型开始预测`}
        </button>
      </div>

      {result && result.predictions.length > 0 && (
        <>
          {savedPredictions.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  已保存的预测结果 ({savedPredictions.length}/{MAX_SAVED_RESULTS})
                </span>
                {savedPredictions.length > 1 && (
                  <button
                    onClick={() => {
                      setSavedPredictions([]);
                      setCurrentIndex(0);
                    }}
                    className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> 清除历史
                  </button>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {savedPredictions.map((pred, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
                      idx === currentIndex
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    #{savedPredictions.length - idx} {pred.time}
                  </button>
                ))}
              </div>
            </div>
          )}

          <ModelContribution result={result} />
          <FunnelVisualization result={result} />
          <ZodiacProbabilities result={result} zodiacTopK={funnelConfig.zodiacTopK} />
          <FinalPredictions result={result} />
          <ProbabilityDistribution result={result} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AttrCard
              title="波色分布"
              items={summarize(result.predictions.map(p => p.color))}
              colors={{
                红波: 'bg-red-100 text-red-700',
                蓝波: 'bg-blue-100 text-blue-700',
                绿波: 'bg-green-100 text-green-700',
              }}
            />
            <AttrCard
              title="五行分布"
              items={summarize(result.predictions.map(p => p.element))}
              colors={{
                金: 'bg-yellow-100 text-yellow-700',
                木: 'bg-green-100 text-green-700',
                水: 'bg-blue-100 text-blue-700',
                火: 'bg-red-100 text-red-700',
                土: 'bg-amber-100 text-amber-700',
              }}
            />
            <AttrCard title="生肖分布" items={summarize(result.predictions.map(p => p.zodiac))} colors={{}} />
          </div>
        </>
      )}

      <PredictionHistory history={history} />

      {!result && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-400">
          <div className="text-5xl mb-4">🎰</div>
          <p className="text-lg">选择模型并调整参数后，点击"开始预测"</p>
          <p className="text-sm mt-2">系统将使用 {data.length} 期历史数据 + {enabledModels.length} 个模型进行融合分析</p>
        </div>
      )}
    </div>
  );
}

export default React.memo(Prediction);
