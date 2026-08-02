import { useState, useEffect, useCallback, useMemo } from 'react';
import { useData } from '../stores/DataContext';
import { useSeparatedModel, SeparatedModelType } from '../stores/SeparatedModelContext';
import { runSeparatedPrediction, BACKTEST_TYPES, buildBacktestType, generateSearchWeights, MODEL_NAMES } from '../engine';
import { SeparatedPredictionResult, HeadTailPredictionItem, ElementPrediction } from '../data/types';
import { calculateNextIssue, calculateNextDate } from '../utils/nextIssueCalculator';
import { getZodiacByNumber } from '../utils/lunarCalendar';
import { Play, Settings2, TrendingUp, Zap, Trash2, Target, CheckCircle, RefreshCw, Clock, ArrowLeftToLine, Plus, X, Send, Copy } from 'lucide-react';
import NumberBall from './NumberBall';
import { saveToStorage, loadFromStorage } from '../utils/storage';

interface SavedSeparatedPrediction {
  time: string;
  result: SeparatedPredictionResult;
  enabledNumberModelIds: string[];
  enabledZodiacModelIds: string[];
  trainLastIssue: string;
  predictIssue: string;
  predictDate: string;
  level1Numbers: number[];
  level1Zodiacs: string[];
}

interface BacktestRecord {
  id: string;
  typeId: string;
  typeName: string;
  bestWeights: { id: string; weight: number }[];
  bestHitRate: number;
  bestBlindHitRate: number;
  blindN: number;
  lookback: number;
  topN: number;
  timestamp: string;
  blindDetails: BlindDetail[];
  inSampleRange: string;
  blindRange: string;
}

interface BlindDetail {
  issue: string;
  predicted: (string | number)[];
  actual: string | number;
  hit: boolean;
}

interface PredictionHit {
  predictIssue: string;
  drawn: boolean;
  actualNumber: number | null;
  numberHit: boolean | null;
  actualZodiac: string | null;
  zodiacHit: boolean | null;
}

const SEPARATED_PREDICTION_KEY = 'lottery_separated_prediction_result';
const BACKTEST_HISTORY_KEY = 'backtest_history';
const MAX_SAVED_RESULTS = 10;
const MAX_BACKTEST_RECORDS = 50;
const API_BASE = 'http://localhost:3001';
const DEFAULT_SCRIPT_REPO_PATH = 'D:\\ailiuhecai\\lottery-system';

const TYPE_META: Record<SeparatedModelType, { title: string; color: string; bg: string }> = {
  number: { title: '号码预测模型', color: 'text-blue-500', bg: 'bg-blue-50 border-blue-200' },
  zodiac: { title: '生肖预测模型', color: 'text-green-500', bg: 'bg-green-50 border-green-200' },
  head: { title: '头数预测模型', color: 'text-purple-500', bg: 'bg-purple-50 border-purple-200' },
  tail: { title: '尾数预测模型', color: 'text-pink-500', bg: 'bg-pink-50 border-pink-200' },
  element: { title: '五行预测模型', color: 'text-amber-500', bg: 'bg-amber-50 border-amber-200' },
};

const MODEL_TYPES: SeparatedModelType[] = ['number', 'zodiac', 'head', 'tail', 'element'];

function ModelPickerModal({ type, selectedIds, available, onToggle, onClose }: {
  type: SeparatedModelType;
  selectedIds: string[];
  available: { id: string; name: string; desc: string; isGeneric?: boolean }[];
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const meta = TYPE_META[type];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <TrendingUp className={`w-4 h-4 ${meta.color}`} />
            选择{meta.title.replace('模型', '')}模型
            <span className="text-xs text-gray-400 font-normal">（勾选添加 / 取消移除）</span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-1 overflow-y-auto flex-1">
          {available.map(m => {
            const checked = selectedIds.includes(m.id);
            return (
              <div key={m.id} className={`flex items-center gap-2 p-2 rounded-lg border ${checked ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-100'}`}>
                <input type="checkbox" checked={checked} onChange={() => onToggle(m.id)}
                  className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-800 truncate">{m.name}</span>
                    {m.isGeneric && (
                      <span className="text-[10px] px-1 py-0.5 bg-cyan-100 text-cyan-700 rounded shrink-0">通用</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 truncate">{m.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">完成</button>
        </div>
      </div>
    </div>
  );
}

function SeparatedPrediction() {
  const { data } = useData();
  const {
    selections, availableModels,
    addModel, removeModel, setModelWeight, applyWeights,
    resetSeparatedModels, autoWeightOptimization, setAutoWeightOptimization,
  } = useSeparatedModel();

  const [savedPredictions, setSavedPredictions] = useState<SavedSeparatedPrediction[]>(() => {
    const saved = localStorage.getItem(SEPARATED_PREDICTION_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBacktest, setShowBacktest] = useState(false);
  const [showBacktestHistory, setShowBacktestHistory] = useState(false);
  const [pickerType, setPickerType] = useState<SeparatedModelType | null>(null);
  const [pushMessage, setPushMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [scriptRepoPath, setScriptRepoPath] = useState<string>(() => localStorage.getItem('script_repo_path') || DEFAULT_SCRIPT_REPO_PATH);
  const [backtestType, setBacktestType] = useState(BACKTEST_TYPES[0]);
  const [backtestLookback, setBacktestLookback] = useState(10);
  const [backtestTopN, setBacktestTopN] = useState(3);
  const [backtestBlindN, setBacktestBlindN] = useState(5);
  const [backtestRunning, setBacktestRunning] = useState(false);
  const [backtestProgress, setBacktestProgress] = useState({ current: 0, total: 0 });
  const [backtestResult, setBacktestResult] = useState<{ bestWeights: { id: string; weight: number }[]; bestHitRate: number; bestBlindHitRate: number; blindTotal: number; blindDetails: BlindDetail[]; inSampleRange: string; blindRange: string } | null>(null);
  const [backtestHistory, setBacktestHistory] = useState<BacktestRecord[]>(() => {
    return loadFromStorage<BacktestRecord[]>(BACKTEST_HISTORY_KEY) || [];
  });

  const result = savedPredictions[currentIndex]?.result ?? null;

  // 命中统计：按 predictIssue 匹配实际开奖
  const hitStats = useMemo<PredictionHit[]>(() => {
    const byIssue = new Map(data.map(d => [d.issue, d]));
    return savedPredictions.map(p => {
      const rec = byIssue.get(p.predictIssue);
      if (!rec) {
        return { predictIssue: p.predictIssue, drawn: false, actualNumber: null, numberHit: null, actualZodiac: null, zodiacHit: null };
      }
      const actualZodiac = getZodiacByNumber(new Date(rec.date), rec.special);
      return {
        predictIssue: p.predictIssue,
        drawn: true,
        actualNumber: rec.special,
        numberHit: p.level1Numbers.includes(rec.special),
        actualZodiac,
        zodiacHit: p.level1Zodiacs.includes(actualZodiac),
      };
    });
  }, [data, savedPredictions]);

  const hitSummary = useMemo(() => {
    const drawn = hitStats.filter(h => h.drawn);
    const numberHits = drawn.filter(h => h.numberHit).length;
    const zodiacHits = drawn.filter(h => h.zodiacHit).length;
    return {
      total: savedPredictions.length,
      drawn: drawn.length,
      pending: savedPredictions.length - drawn.length,
      numberRate: drawn.length > 0 ? numberHits / drawn.length : 0,
      numberHits,
      zodiacRate: drawn.length > 0 ? zodiacHits / drawn.length : 0,
      zodiacHits,
    };
  }, [hitStats, savedPredictions.length]);

  useEffect(() => {
    localStorage.setItem(SEPARATED_PREDICTION_KEY, JSON.stringify(savedPredictions));
  }, [savedPredictions]);

  useEffect(() => {
    saveToStorage(backtestHistory, BACKTEST_HISTORY_KEY);
  }, [backtestHistory]);

  useEffect(() => {
    localStorage.setItem('script_repo_path', scriptRepoPath);
  }, [scriptRepoPath]);

  const selectedCountFor = (type: SeparatedModelType) => selections[type].length;

  const runPredict = useCallback(async () => {
    if (selections.number.length === 0 && selections.zodiac.length === 0) {
      alert('请至少选择一个号码或生肖模型');
      return;
    }
    setLoading(true);
    const predictionResult = runSeparatedPrediction(
      data,
      selections.number,
      selections.zodiac,
      selections.head,
      selections.tail,
      selections.element,
      autoWeightOptimization
    );

    const newPrediction: SavedSeparatedPrediction = {
      time: new Date().toLocaleString(),
      result: predictionResult,
      enabledNumberModelIds: selections.number.map(m => m.id),
      enabledZodiacModelIds: selections.zodiac.map(m => m.id),
      trainLastIssue: data[data.length - 1]?.issue || '',
      predictIssue: calculateNextIssue(data[data.length - 1]),
      predictDate: calculateNextDate(data[data.length - 1]?.date || ''),
      level1Numbers: predictionResult.numberPredictions.level1.map((p: any) => p.number),
      level1Zodiacs: predictionResult.zodiacPredictions.level1.map((p: any) => p.zodiac),
    };

    setSavedPredictions(prev => [newPrediction, ...prev].slice(0, MAX_SAVED_RESULTS));
    setCurrentIndex(0);
    setLoading(false);
  }, [data, selections, autoWeightOptimization]);

  const handleBacktest = useCallback(() => {
    const selectedIds = selections[backtestType.id as SeparatedModelType].map(m => m.id);
    const bt = buildBacktestType(backtestType.id, selectedIds);
    if (!bt) {
      alert('该类型尚未选择任何模型，请先在模型设置中添加模型');
      return;
    }
    const { modelIds, resolveFn, outputType, categories, getActual } = bt;
    setBacktestRunning(true);
    setBacktestResult(null);
    const blindN = Math.max(0, Math.min(backtestBlindN, data.length - 10));
    const blindStart = data.length - blindN;
    if (data.length < backtestLookback + blindN + 5) {
      setBacktestRunning(false);
      alert('数据不足，请减小回测期数或屏蔽期数');
      return;
    }
    const allCombos = generateSearchWeights(modelIds.length);
    const total = allCombos.length;
    let bestWeights = allCombos[0];
    let bestHitRate = 0;
    let ci = 0;
    const chunkSize = Math.max(1, Math.floor(total / 200));

    const processChunk = () => {
      const end = Math.min(ci + chunkSize, total);
      for (; ci < end; ci++) {
        const weights = allCombos[ci];
        let hits = 0;
        for (let pi = blindStart - backtestLookback; pi < blindStart; pi++) {
          const trainData = data.slice(0, pi);
          const testRecord = data[pi];
          const lastIssue = trainData[trainData.length - 1]?.issue || '0';
          const seed = lastIssue.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0) & 0x7fffffff;

          if (outputType === 'category_map' && categories) {
            const fused: Record<string, number> = {};
            categories.forEach(c => fused[c] = 0);
            modelIds.forEach((id, i) => {
              const probs = resolveFn(id)(trainData, seed + i * 1000) as Record<string, number>;
              Object.entries(probs).forEach(([c, p]) => { fused[c] = (fused[c] || 0) + weights[i] * p; });
            });
            const totalP = Object.values(fused).reduce((a, b) => a + b, 0) || 1;
            categories.forEach(c => fused[c] = (fused[c] || 0) / totalP);
            const sorted = categories.map(c => ({ c, p: fused[c] || 0 })).sort((a, b) => b.p - a.p);
            const actual = getActual(testRecord) as string;
            const rank = sorted.findIndex(x => x.c === actual);
            if (rank >= 0 && rank < backtestTopN) hits++;
          } else {
            const fused = new Array(49).fill(0);
            modelIds.forEach((id, i) => {
              const probs = resolveFn(id)(trainData, seed + i * 1000) as number[];
              for (let j = 0; j < 49; j++) fused[j] += weights[i] * probs[j];
            });
            const sorted = Array.from({ length: 49 }, (_, i) => i + 1)
              .map(n => ({ n, p: fused[n - 1] }))
              .sort((a, b) => b.p - a.p);
            const actual = getActual(testRecord) as number;
            const rank = sorted.findIndex(x => x.n === actual);
            if (rank >= 0 && rank < backtestTopN) hits++;
          }
        }
        const hitRate = hits / backtestLookback;
        if (hitRate > bestHitRate) { bestHitRate = hitRate; bestWeights = weights; }
      }
      setBacktestProgress({ current: ci, total });
      if (ci < total) {
        setTimeout(processChunk, 0);
      } else {
        const bestWeightsArr = modelIds.map((id, i) => ({ id, weight: bestWeights[i] }));
        // 样本外盲测：用最优权重对屏蔽区逐期预测
        let blindHits = 0;
        const blindDetails: BlindDetail[] = [];
        if (blindN > 0) {
          for (let pi = blindStart; pi < data.length; pi++) {
            const trainData = data.slice(0, pi);
            const testRecord = data[pi];
            const issueLabel = String(testRecord.issue || (pi + 1)).slice(-3);
            const lastIssue = trainData[trainData.length - 1]?.issue || '0';
            const seed = lastIssue.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0) & 0x7fffffff;
            if (outputType === 'category_map' && categories) {
              const fused: Record<string, number> = {};
              categories.forEach(c => fused[c] = 0);
              modelIds.forEach((id, i) => {
                const probs = resolveFn(id)(trainData, seed + i * 1000) as Record<string, number>;
                Object.entries(probs).forEach(([c, p]) => { fused[c] = (fused[c] || 0) + bestWeights[i] * p; });
              });
              const sorted = categories.map(c => ({ c, p: fused[c] || 0 })).sort((a, b) => b.p - a.p);
              const actual = getActual(testRecord) as string;
              const rank = sorted.findIndex(x => x.c === actual);
              const hit = rank >= 0 && rank < backtestTopN;
              if (hit) blindHits++;
              blindDetails.push({ issue: issueLabel, predicted: sorted.slice(0, backtestTopN).map(x => x.c), actual, hit });
            } else {
              const fused = new Array(49).fill(0);
              modelIds.forEach((id, i) => {
                const probs = resolveFn(id)(trainData, seed + i * 1000) as number[];
                for (let j = 0; j < 49; j++) fused[j] += bestWeights[i] * probs[j];
              });
              const sorted = Array.from({ length: 49 }, (_, i) => i + 1)
                .map(n => ({ n, p: fused[n - 1] }))
                .sort((a, b) => b.p - a.p);
              const actual = getActual(testRecord) as number;
              const rank = sorted.findIndex(x => x.n === actual);
              const hit = rank >= 0 && rank < backtestTopN;
              if (hit) blindHits++;
              blindDetails.push({ issue: issueLabel, predicted: sorted.slice(0, backtestTopN).map(x => x.n), actual, hit });
            }
          }
        }
        const bestBlindHitRate = blindN > 0 ? blindHits / blindN : 0;
        const issueLabel = (i: number) => String(data[i]?.issue ?? (i + 1)).slice(-3);
        const inSampleRange = `${issueLabel(blindStart - backtestLookback)}~${issueLabel(blindStart - 1)}`;
        const blindRange = blindN > 0 ? `${issueLabel(blindStart)}~${issueLabel(data.length - 1)}` : '';
        setBacktestResult({ bestWeights: bestWeightsArr, bestHitRate, bestBlindHitRate, blindTotal: blindN, blindDetails, inSampleRange, blindRange });
        setBacktestRunning(false);
        const record: BacktestRecord = {
          id: Date.now().toString(36),
          typeId: bt.id,
          typeName: bt.name,
          bestWeights: bestWeightsArr,
          bestHitRate,
          bestBlindHitRate,
          blindN,
          lookback: backtestLookback,
          topN: backtestTopN,
          timestamp: new Date().toLocaleString(),
          blindDetails,
          inSampleRange,
          blindRange,
        };
        setBacktestHistory(prev => [record, ...prev].slice(0, MAX_BACKTEST_RECORDS));
      }
    };
    setTimeout(processChunk, 0);
  }, [data, backtestType, backtestLookback, backtestTopN, backtestBlindN, selections]);

  const applyBacktestWeights = useCallback((record: BacktestRecord) => {
    applyWeights(record.typeId as SeparatedModelType, record.bestWeights);
  }, [applyWeights]);

  const clearBacktestHistory = () => setBacktestHistory([]);

  const buildPushConfig = useCallback(() => ({
    number: selections.number,
    zodiac: selections.zodiac,
    head: selections.head,
    tail: selections.tail,
    element: selections.element,
  }), [selections]);

  const handlePushConfig = useCallback(async () => {
    setPushMessage(null);
    const config = buildPushConfig();
    const repoPath = scriptRepoPath.trim();
    try {
      const res = await fetch(`${API_BASE}/api/models/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, repoPath: repoPath || undefined, autoGit: !!repoPath }),
      });
      const json = await res.json();
      if (json.success) {
        setPushMessage({ ok: true, text: json.message || '模型配置已推送' });
      } else {
        setPushMessage({ ok: false, text: json.message || '推送失败' });
      }
    } catch (e: any) {
      setPushMessage({ ok: false, text: '无法连接后端服务：' + e.message });
    }
  }, [buildPushConfig, scriptRepoPath]);

  const copyPushConfig = useCallback(async () => {
    const config = buildPushConfig();
    const text = JSON.stringify(config, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setPushMessage({ ok: true, text: '配置已复制到剪贴板，请保存为 scripts/predictor/config.json' });
    } catch {
      setPushMessage({ ok: false, text: '复制失败' });
    }
  }, [buildPushConfig]);

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
              onClick={() => setShowBacktest(!showBacktest)}
              className={`px-3 py-2 border rounded-lg flex items-center gap-2 ${showBacktest ? 'bg-orange-50 border-orange-300 text-orange-700' : 'border-gray-200 hover:bg-gray-50'}`}
            >
              <Target className="w-4 h-4" />
              回测调优
            </button>
            <button
              onClick={handlePushConfig}
              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              title="将当前模型配置推送并提交到脚本仓库（使用已保存的仓库路径，无需再次输入）"
            >
              <Send className="w-4 h-4" />
              一键推送
            </button>
            <button
              onClick={runPredict}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 flex items-center gap-2"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />预测中...</>
              ) : (
                <><Play className="w-4 h-4" />开始预测</>
              )}
            </button>
          </div>
        </div>
        {pushMessage && (
          <div className={`mt-1 text-xs ${pushMessage.ok ? 'text-green-600' : 'text-red-500'}`}>{pushMessage.text}</div>
        )}

        {savedPredictions.length > 0 && (
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
            <button onClick={() => navigatePrediction('prev')} disabled={currentIndex === 0}
              className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">上一条</button>
            <div className="text-center">
              <div className="text-sm text-gray-600">{currentIndex + 1} / {savedPredictions.length} · {savedPredictions[currentIndex]?.time}</div>
              {savedPredictions[currentIndex]?.trainLastIssue && (
                <div className="text-xs text-indigo-600 font-medium mt-0.5">
                  基于第{savedPredictions[currentIndex].trainLastIssue.slice(-3)}期 → 预测第{savedPredictions[currentIndex].predictIssue.slice(-3)}期 ({savedPredictions[currentIndex].predictDate})
                </div>
              )}
            </div>
            <button onClick={() => navigatePrediction('next')} disabled={currentIndex === savedPredictions.length - 1}
              className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">下一条</button>
            <button onClick={() => deletePrediction(currentIndex)}
              className="px-2 py-1 text-red-500 hover:bg-red-50 rounded border border-red-200 hover:text-red-700" title="删除本条预测">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 模型设置面板 */}
      {showSettings && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {MODEL_TYPES.map(type => {
              const meta = TYPE_META[type];
              const selected = selections[type];
              const count = selectedCountFor(type);
              return (
                <div key={type} className={`rounded-xl border p-4 ${meta.bg}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                      <TrendingUp className={`w-4 h-4 ${meta.color}`} />
                      {meta.title}
                      <span className="text-xs font-normal text-gray-400">{count} 个模型</span>
                    </h3>
                    <button onClick={() => setPickerType(type)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50">
                      <Plus className="w-3 h-3" />添加/管理模型
                    </button>
                  </div>
                  {selected.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-3">暂无已选模型，点击「添加/管理模型」从模型库选择</p>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {selected.map(m => (
                        <div key={m.id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-100">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-gray-800 text-sm truncate">{MODEL_NAMES[m.id] || m.id}</div>
                            <div className="text-xs text-gray-400 truncate">{availableModels[type].find(a => a.id === m.id)?.desc || ''}</div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <input type="number" min="0" max="1" step="0.05" value={m.weight}
                              onChange={e => setModelWeight(type, m.id, parseFloat(e.target.value))}
                              className="w-14 px-1 py-0.5 border border-gray-200 rounded text-xs text-center" />
                            <button onClick={() => removeModel(type, m.id)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" title="移除模型">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={autoWeightOptimization}
                onChange={(e) => setAutoWeightOptimization(e.target.checked)}
                className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">启用自动权重优化（号码/生肖）</span>
              <span className="text-xs text-gray-500">（每次预测时根据模型表现自动调整权重）</span>
            </label>
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <label className="text-sm text-gray-600 block mb-1">自动发送脚本仓库路径（可选，填了才自动 git commit + push）</label>
            <input
              value={scriptRepoPath}
              onChange={e => setScriptRepoPath(e.target.value)}
              placeholder="例如 D:\auto-send-script（仓库根目录，需含 scripts/predictor/config.json）"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <p className="text-xs text-gray-400 mt-1">推送时只提交并推送 scripts/predictor/config.json 这一个文件，不涉及仓库其他改动</p>
          </div>

          <div className="mt-4 flex justify-between items-center gap-2">
            <button onClick={resetSeparatedModels}
              className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">重置为默认</button>
            <div className="flex items-center gap-2">
              {pushMessage && (
                <span className={`text-xs ${pushMessage.ok ? 'text-green-600' : 'text-red-500'} max-w-xs truncate`}>{pushMessage.text}</span>
              )}
              <button onClick={copyPushConfig}
                className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm flex items-center gap-1.5">
                <Copy className="w-4 h-4" />复制配置
              </button>
              <button onClick={handlePushConfig}
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm flex items-center gap-1.5">
                <Send className="w-4 h-4" />推送配置到脚本
              </button>
              <button onClick={clearHistory}
                className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">清空历史</button>
            </div>
          </div>
        </div>
      )}

      {/* 回测调优面板 */}
      {showBacktest && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Target className="w-5 h-5 text-orange-500" />回测调优
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowBacktestHistory(!showBacktestHistory)}
                className={`px-3 py-1.5 border rounded-lg text-sm flex items-center gap-1.5 ${showBacktestHistory ? 'bg-gray-100 border-gray-300' : 'border-gray-200 hover:bg-gray-50'}`}>
                <Clock className="w-3.5 h-3.5" />历史记录
              </button>
              <button onClick={() => { setShowBacktest(false); setBacktestResult(null); }}
                className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <div>
              <label className="text-sm text-gray-500 block mb-1">目标类型</label>
              <select value={backtestType.id} onChange={e => { const t = BACKTEST_TYPES.find(bt => bt.id === e.target.value); if (t) setBacktestType(t); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                {BACKTEST_TYPES.map(bt => (
                  <option key={bt.id} value={bt.id}>{bt.name}（已选{selectedCountFor(bt.id as SeparatedModelType)}模型）</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-500 block mb-1">回测期数</label>
              <input type="number" min={5} max={50} value={backtestLookback}
                onChange={e => setBacktestLookback(Math.max(5, Math.min(50, parseInt(e.target.value) || 10)))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-500 block mb-1">命中判定（TopN）</label>
              <input type="number" min={1} max={20} value={backtestTopN}
                onChange={e => setBacktestTopN(Math.max(1, Math.min(20, parseInt(e.target.value) || 3)))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-500 block mb-1">屏蔽期数（样本外盲测）</label>
              <input type="number" min={0} max={20} value={backtestBlindN}
                onChange={e => setBacktestBlindN(Math.max(0, Math.min(20, parseInt(e.target.value) || 0)))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" title="最近 N 期完全屏蔽，不参与权重寻优，仅用于验证最优权重" />
            </div>
            <div className="flex items-end">
              <button onClick={handleBacktest} disabled={backtestRunning}
                className="w-full py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 flex items-center justify-center gap-2">
                {backtestRunning ? <><RefreshCw className="w-4 h-4 animate-spin" /> 回测中...</>
                  : <><Target className="w-4 h-4" /> 开始回测</>}
              </button>
            </div>
          </div>

          {backtestRunning && backtestProgress.total > 0 && (
            <div className="mb-4">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 transition-all duration-200" style={{ width: `${(backtestProgress.current / backtestProgress.total) * 100}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">已评估 {backtestProgress.current} / {backtestProgress.total} 种权重组合</p>
            </div>
          )}

          {backtestResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-800">回测完成</span>
                <span className="text-sm text-green-600 ml-2">
                  最优命中率：<b>{(backtestResult.bestHitRate * 100).toFixed(1)}%</b>（共 {backtestProgress.total} 种组合）
                </span>
              </div>
              <div className="mb-3 text-xs text-gray-600 bg-white rounded-lg border border-green-100 p-2">
                寻优窗口：第 <b>{backtestResult.inSampleRange}</b> 期（{backtestLookback} 期，用于寻找最优权重）
                {backtestResult.blindRange && <> · 盲测窗口：第 <b>{backtestResult.blindRange}</b> 期（{backtestResult.blindTotal} 期，完全屏蔽）</>}
              </div>
              {backtestResult.blindTotal > 0 && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm text-blue-700 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    样本外盲测（屏蔽最近 {backtestResult.blindTotal} 期）：命中率 <b className="text-blue-900">{(backtestResult.bestBlindHitRate * 100).toFixed(1)}%</b>
                  </div>
                  <p className="text-xs text-blue-500 mt-1">屏蔽区不参与权重寻优，结果更能反映真实泛化能力</p>
                  {backtestResult.blindDetails.length > 0 && (
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-xs bg-white rounded-lg">
                        <thead>
                          <tr className="text-gray-500 text-left">
                            <th className="px-2 py-1 border-b">期数</th>
                            <th className="px-2 py-1 border-b">预测 Top{backtestTopN}</th>
                            <th className="px-2 py-1 border-b">实际开奖</th>
                            <th className="px-2 py-1 border-b">命中</th>
                          </tr>
                        </thead>
                        <tbody>
                          {backtestResult.blindDetails.map(d => (
                            <tr key={d.issue} className="border-b border-gray-100 last:border-0">
                              <td className="px-2 py-1 font-medium">第{d.issue}期</td>
                              <td className="px-2 py-1">{d.predicted.join(' ')}</td>
                              <td className="px-2 py-1 font-semibold">{String(d.actual)}</td>
                              <td className="px-2 py-1">{d.hit ? <span className="text-green-600 font-bold">✓ 命中</span> : <span className="text-red-500">✗</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {backtestResult.bestWeights.map(w => (
                  <div key={w.id} className="bg-white px-3 py-1.5 rounded-lg border border-green-200 text-sm">
                    <span className="text-gray-600">{MODEL_NAMES[w.id] || w.id}：</span>
                    <span className="font-bold text-green-700">{(w.weight * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showBacktestHistory && (
            <div className="border-t border-gray-200 pt-4 mt-2">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />回测历史记录
                </h4>
                {backtestHistory.length > 0 && (
                  <button onClick={clearBacktestHistory}
                    className="text-xs text-red-500 hover:text-red-700">清空记录</button>
                )}
              </div>
              {backtestHistory.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">暂无回测记录</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {backtestHistory.map(record => (
                    <div key={record.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">{record.typeName}</span>
                          <span className="text-xs text-green-600 font-semibold">{(record.bestHitRate * 100).toFixed(1)}%</span>
                          {record.blindN > 0 && (
                            <span className="text-xs text-blue-600 font-semibold" title="样本外盲测命中率">盲测{(record.bestBlindHitRate * 100).toFixed(1)}%</span>
                          )}
                          <span className="text-xs text-gray-400">{record.lookback}期 Top{record.topN}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {record.bestWeights.slice(0, 5).map(w => (
                            <span key={w.id} className="text-xs text-gray-500 bg-white px-1.5 py-0.5 rounded border border-gray-200">
                              {MODEL_NAMES[w.id] || w.id}: {(w.weight * 100).toFixed(0)}%
                            </span>
                          ))}
                          {record.bestWeights.length > 5 && (
                            <span className="text-xs text-gray-400">+{record.bestWeights.length - 5}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{record.timestamp}</div>
                      </div>
                      <button onClick={() => applyBacktestWeights(record)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 text-xs font-medium ml-2 shrink-0">
                        <ArrowLeftToLine className="w-3 h-3" />应用
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 添加模型弹窗 */}
      {pickerType && (
        <ModelPickerModal
          type={pickerType}
          selectedIds={selections[pickerType].map(m => m.id)}
          available={availableModels[pickerType]}
          onToggle={id => {
            const exists = selections[pickerType].some(m => m.id === id);
            if (exists) removeModel(pickerType, id);
            else addModel(pickerType, id);
          }}
          onClose={() => setPickerType(null)}
        />
      )}

      {/* 预测结果展示 */}
      {result && result.numberPredictions && (() => {
        const predIssue = savedPredictions[currentIndex]?.predictIssue?.slice(-3) || '—';
        const trainIssue = savedPredictions[currentIndex]?.trainLastIssue?.slice(-3) || '—';
        const predDate = savedPredictions[currentIndex]?.predictDate || '—';
        const level1Numbers = (result.numberPredictions.level1 || []).map((p: any) => p.number);
        const level1Zodiacs = (result.zodiacPredictions.level1 || []).map((p: any) => p.zodiac);
        const combos = result.combinedRecommendations?.combos || [];

        const heads = result.headPredictions || [];
        const tails = result.tailPredictions || [];
        const elements: ElementPrediction[] = ((result as any).elementPredictions || []).slice(0, 4);

        const elementTextColor = (el: string) => {
          const map: Record<string, string> = { '金': 'text-yellow-600', '木': 'text-green-600', '水': 'text-blue-600', '火': 'text-red-500', '土': 'text-amber-800' };
          return map[el] || 'text-gray-600';
        };
        const elementBarColor = (el: string) => {
          const map: Record<string, string> = { '金': 'bg-yellow-500', '木': 'bg-green-500', '水': 'bg-blue-500', '火': 'bg-red-400', '土': 'bg-amber-600' };
          return map[el] || 'bg-gray-400';
        };

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
          ``,
          ...(heads.length > 0 ? [`🔢 头数预测 Top 4：`, heads.map((h: HeadTailPredictionItem) => h.label).join(' '), ``] : []),
          ...(tails.length > 0 ? [`🔢 尾数预测 Top 8：`, tails.map((t: HeadTailPredictionItem) => t.label).join(' ')] : []),
          ...(elements.length > 0 ? [``, `🪐 五行预测 Top ${elements.length}：`, elements.map((e: ElementPrediction) => e.element).join(' ')] : []),
        ].join('\n');

        const handleCopy = () => {
          navigator.clipboard.writeText(copyText).then(() => alert('已复制到剪贴板')).catch(() => {
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-lg font-bold text-gray-800">第{predIssue}期预测结果</div>
                  <div className="text-sm text-gray-500 mt-0.5">基于第{trainIssue}期数据 · {predDate} · {result.activeModelCount}个模型</div>
                  {(() => {
                    const h = hitStats[currentIndex];
                    if (!h) return null;
                    if (!h.drawn) {
                      return <div className="mt-1 text-xs text-gray-400">该期尚未开奖，暂无命中判定</div>;
                    }
                    return (
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        <span className={`px-2 py-0.5 rounded-full ${h.numberHit ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          号码 {h.actualNumber}：{h.numberHit ? '✓ 命中' : '✗ 未中'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full ${h.zodiacHit ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          生肖 {h.actualZodiac}：{h.zodiacHit ? '✓ 命中' : '✗ 未中'}
                        </span>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCopy} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">📋 复制</button>
                  <button onClick={handleExport} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">💾 导出</button>
                </div>
              </div>
            </div>

            {hitSummary.total > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div className="font-semibold text-gray-700">命中统计</div>
                <div className="text-gray-500">预测 {hitSummary.total} 条 · 已开奖 {hitSummary.drawn} · 待开奖 {hitSummary.pending}</div>
                <div className="text-gray-600">号码命中 <b className="text-green-600">{hitSummary.numberHits}/{hitSummary.drawn}</b>（{(hitSummary.numberRate * 100).toFixed(1)}%）</div>
                <div className="text-gray-600">生肖命中 <b className="text-green-600">{hitSummary.zodiacHits}/{hitSummary.drawn}</b>（{(hitSummary.zodiacRate * 100).toFixed(1)}%）</div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">📊 号码第一层<span className="ml-2 text-sm font-normal text-gray-500">{level1Numbers.length}个</span></h3>
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

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">🐲 生肖第一层<span className="ml-2 text-sm font-normal text-gray-500">{level1Zodiacs.length}个</span></h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(result.zodiacPredictions.level1 || []).map((pred: any) => (
                    <div key={pred.zodiac} className="flex flex-col items-center p-2 bg-indigo-50 rounded-lg min-w-[52px]">
                      <div className="w-9 h-9 flex items-center justify-center bg-indigo-500 text-white rounded-full font-bold text-base">{pred.zodiac}</div>
                      <span className="text-xs text-gray-500 mt-1">{(pred.probability * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-5 text-white">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold">🎯 综合推荐</h3>
                <span className="text-sm opacity-80">第{predIssue}期 · {predDate}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {combos.map((combo: any, index: number) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-white/20 rounded-lg">
                    <span className="text-sm font-bold opacity-80">推荐{index + 1}</span>
                    <div className="w-10 h-10 flex items-center justify-center bg-green-400 rounded-full font-bold text-lg">{combo.zodiac}</div>
                    <span className="text-xl font-bold">+</span>
                    <div className="w-10 h-10 flex items-center justify-center bg-red-400 rounded-full font-bold text-base">{String(combo.number).padStart(2, '0')}</div>
                    <span className="text-xs opacity-70 ml-auto">{((combo.probability || 0) * 100).toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {heads.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-800">头数预测 Top 4</h4>
                    <button onClick={() => {
                      navigator.clipboard.writeText(heads.map((h: HeadTailPredictionItem) => {
                        const l = h.label === '0' ? '0头 (1-9)' : `${h.label}头 (${+h.label * 10}-${+h.label * 10 + 9})`;
                        return `#${h.rank} ${l} ${(h.probability * 100).toFixed(1)}%`;
                      }).join('\n'));
                    }} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">复制</button>
                  </div>
                  <div className="space-y-2">
                    {heads.map((item: HeadTailPredictionItem) => {
                      const h = item.label.replace('头', '');
                      const label = h === '0' ? '0头 (1-9)' : `${h}头 (${+h * 10}-${+h * 10 + 9})`;
                      return (
                        <div key={item.label} className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">{item.rank}</span>
                          <span className="text-sm text-gray-700 font-medium">{label}</span>
                          <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.max(item.probability * 100, 3)}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 font-mono w-14 text-right">{(item.probability * 100).toFixed(1)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {tails.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-800">尾数预测 Top 8</h4>
                    <button onClick={() => navigator.clipboard.writeText(tails.map((t: HeadTailPredictionItem) => `#${t.rank} ${t.label} ${(t.probability * 100).toFixed(1)}%`).join('\n'))}
                      className="text-xs text-pink-600 hover:text-pink-800 flex items-center gap-1">复制</button>
                  </div>
                  <div className="space-y-1.5">
                    {tails.map((item: HeadTailPredictionItem) => (
                      <div key={item.label} className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-pink-100 text-pink-700 text-xs font-bold flex items-center justify-center shrink-0">{item.rank}</span>
                        <span className="text-sm text-gray-700 font-medium w-12">{item.label}</span>
                        <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-pink-500 rounded-full" style={{ width: `${Math.max(item.probability * 100, 3)}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 font-mono w-14 text-right">{(item.probability * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {elements.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-800">五行预测 Top {elements.length}</h4>
                    <button onClick={() => navigator.clipboard.writeText(elements.map((e: ElementPrediction) => `#${e.rank} ${e.element} ${(e.probability * 100).toFixed(1)}%`).join('\n'))}
                      className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1">复制</button>
                  </div>
                  <div className="space-y-1.5">
                    {elements.map((item: ElementPrediction) => (
                      <div key={item.element} className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0">{item.rank}</span>
                        <span className={`text-sm font-medium w-8 ${elementTextColor(item.element)}`}>{item.element}</span>
                        <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${elementBarColor(item.element)}`} style={{ width: `${Math.max(item.probability * 100, 3)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">文本预览（可直接选中复制）</span>
                <button onClick={handleCopy} className="text-xs text-indigo-600 hover:underline">一键复制</button>
              </div>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed select-all">{copyText}</pre>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default SeparatedPrediction;
