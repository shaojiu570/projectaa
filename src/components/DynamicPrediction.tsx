import { useState, useCallback, useEffect, useMemo } from 'react';
import { useData } from '../stores/DataContext';
import { useModelLibrary } from '../stores/ModelLibraryContext';
import { runPrediction, BUILTIN_TYPES, autoTuneWeights, computeTopN, zodiacOfRecord, elementOfRecord } from '../models/dynamic';
import { runTypeBacktest, TypeBacktestResult } from '../engine/backtest';
import { DrawRecord } from '../data/types';
import { PredictionTypeConfig, DynamicPredictionRecord } from '../models/dynamic/types';
import { calculateNextIssue, calculateNextDate } from '../utils/nextIssueCalculator';
import { saveToStorage, loadFromStorage, clearStorage } from '../utils/storage';
import NumberBall from './NumberBall';
import {
  Play, Zap, Plus, Trash2, Clock, ChevronDown, ChevronRight, History,
  Hash, X, RefreshCw, Target, Sparkles, BarChart3, Copy, ClipboardCheck, Send, SendHorizontal,
} from 'lucide-react';

const RECORDS_KEY = 'lottery_dynamic_records';
const TYPES_KEY = 'lottery_dynamic_types';
const API_BASE = 'http://localhost:3001';
const DEFAULT_SCRIPT_REPO_PATH = 'D:\\ailiuhecai\\lottery-system';

const ALGO_NAMES: Record<string, string> = {
  hot: '热度', cold: '遗漏', cycle: '周期', markov: '马尔科夫',
  ma: '移动平均', condProb: '条件概率', bayes: '贝叶斯', apriori: 'Apriori',
  rf: '随机森林', xgboost: 'XGBoost', lstm: 'LSTM',
  genetic: '遗传算法', rl: '强化学习', bandit: '老虎机',
};

function buildDefaultTypes(): PredictionTypeConfig[] {
  return BUILTIN_TYPES.map(b => ({
    id: b.id, name: b.name, enabled: true,
    resultCount: b.resultCountPresets[1],
    selectedAlgorithms: ['hot', 'cold', 'cycle', 'markov'].map(id => ({ id, weight: 0.25 })),
    categories: b.categories, numberRanges: b.numberRanges, isBuiltin: true, autoWeight: false,
  }));
}

function ProbBar({ value, color = 'bg-indigo-500' }: { value: number; color?: string }) {
  const pct = (value * 100).toFixed(1);
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.min(100, parseFloat(pct))}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-500 w-10 text-right">{pct}%</span>
    </div>
  );
}

function generateTextResult(result: {
  issue: string; date: string;
  typeResults: { typeName: string; categories: { category: string; probability: number }[] }[];
  finalNumbers: { number: number; probability: number }[];
}, topN: number): string {
  const lines: string[] = [];
  lines.push('===== 六合彩特码预测 =====');
  lines.push(`第${result.issue.slice(-3)}期 | ${result.date}`);
  lines.push('');
  for (const tr of result.typeResults) {
    const cats = tr.categories.map(cp => cp.category).join(' ');
    lines.push(`【${tr.typeName}】${cats}`);
  }
  lines.push('');
  const nums = result.finalNumbers.slice(0, topN).map(p => String(p.number).padStart(2, '0')).join(' ');
  lines.push(`【推荐 ${topN} 码】${nums}`);
  lines.push('========================');
  return lines.join('\n');
}

function CustomTypeModal({ open, onClose, onSave }: {
  open: boolean; onClose: () => void;
  onSave: (cfg: PredictionTypeConfig) => void;
}) {
  const [name, setName] = useState('');
  const [rows, setRows] = useState<{ cat: string; nums: string }[]>([{ cat: '', nums: '' }]);
  const handleSave = () => {
    const valid = rows.filter(r => r.cat.trim() && r.nums.trim());
    if (!name.trim() || valid.length === 0) return;
    const categories = valid.map(r => r.cat.trim());
    const numberRanges = valid.map(r => {
      const nums: number[] = [];
      const parts = r.nums.split(/[,，、\s]+/).filter(Boolean);
      for (const p of parts) {
        if (p.includes('-')) {
          const [a, b] = p.split('-').map(s => parseInt(s.replace(/[^\d]/g, '')));
          if (!isNaN(a) && !isNaN(b)) for (let n = Math.min(a, b); n <= Math.max(a, b); n++) nums.push(n);
        } else {
          const n = parseInt(p.replace(/[^\d]/g, ''));
          if (!isNaN(n)) nums.push(n);
        }
      }
      return [...new Set(nums)].filter(n => n >= 1 && n <= 49).sort((a, b) => a - b);
    });
    onSave({
      id: 'custom_' + Date.now(), name: name.trim(), enabled: true,
      resultCount: Math.min(3, categories.length),
      selectedAlgorithms: ['hot', 'cold', 'cycle', 'markov'].map(id => ({ id, weight: 0.25 })),
      categories, numberRanges,
      isBuiltin: false, autoWeight: false,
    });
    setName(''); setRows([{ cat: '', nums: '' }]); onClose();
  };
  const addRow = () => setRows([...rows, { cat: '', nums: '' }]);
  const delRow = (i: number) => rows.length > 1 && setRows(rows.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: 'cat' | 'nums', val: string) => {
    const u = [...rows]; u[i] = { ...u[i], [field]: val }; setRows(u);
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800 text-lg mb-1">添加自定义预测类型</h3>
        <p className="text-xs text-gray-400 mb-4">定义分类及每个分类包含的号码</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">类型（名称）</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="例如：大小类" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="border-t border-gray-100 pt-3">
            <label className="text-xs text-gray-500 font-medium mb-2 block">分类与号码映射</label>
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <input value={r.cat} onChange={e => updateRow(i, 'cat', e.target.value)}
                  placeholder="分类" className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <span className="text-gray-300 text-sm">→</span>
                <input value={r.nums} onChange={e => updateRow(i, 'nums', e.target.value)}
                  placeholder="号码（如 1-24 或 01,03,05）" className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                {rows.length > 1 && (
                  <button onClick={() => delRow(i)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl"><X className="w-4 h-4" /></button>
                )}
                {i === rows.length - 1 && (
                  <button onClick={addRow} className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl"><Plus className="w-4 h-4" /></button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">取消</button>
            <button onClick={handleSave} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm hover:bg-indigo-700">保存</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RangeEditor({ config, onSave, onClose }: {
  config: PredictionTypeConfig; onSave: (c: PredictionTypeConfig) => void; onClose: () => void;
}) {
  const [ranges, setRanges] = useState(() => config.categories.map((c, i) => ({
    category: c, numbers: (config.numberRanges[i] || []).join(','),
  })));
  const parseNums = (raw: string) => {
    const nums: number[] = [];
    const parts = raw.split(/[,，、\s]+/).filter(Boolean);
    for (const p of parts) {
      if (p.includes('-')) {
        const [a, b] = p.split('-').map(s => parseInt(s.replace(/[^\d]/g, '')));
        if (!isNaN(a) && !isNaN(b)) for (let n = Math.min(a, b); n <= Math.max(a, b); n++) nums.push(n);
      } else {
        const n = parseInt(p.replace(/[^\d]/g, ''));
        if (!isNaN(n)) nums.push(n);
      }
    }
    return [...new Set(nums)].filter(n => n >= 1 && n <= 49).sort((a, b) => a - b);
  };
  const handleSave = () => {
    const cats = ranges.map(r => r.category.trim()).filter(Boolean);
    const nums = ranges.map(r => parseNums(r.numbers));
    onSave({ ...config, categories: cats, numberRanges: nums, resultCount: Math.min(config.resultCount, cats.length) });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800 text-lg mb-1">编辑号码映射 - {config.name}</h3>
        <p className="text-xs text-gray-400 mb-4">每行：分类名 → 号码（支持逗号分隔或范围如 1-24）</p>
        <div className="space-y-3">
          {ranges.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={r.category} onChange={e => { const u = [...ranges]; u[i] = { ...u[i], category: e.target.value }; setRanges(u); }}
                className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <span className="text-gray-300 text-sm">→</span>
              <input value={r.numbers} onChange={e => { const u = [...ranges]; u[i] = { ...u[i], numbers: e.target.value }; setRanges(u); }}
                placeholder="号码（如 1-24 或 01,03,05）" className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">取消</button>
          <button onClick={handleSave} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm hover:bg-indigo-700">保存</button>
        </div>
      </div>
    </div>
  );
}

interface TypeCardProps {
  type: PredictionTypeConfig;
  onToggle: () => void;
  onResultCount: (n: number) => void;
  onAlgoToggle: (id: string) => void;
  onAlgoWeight: (id: string, w: number) => void;
  onToggleAutoWeight: () => void;
  onDelete: () => void;
  onEditRange: () => void;
}

function TypeCard({ type, onToggle, onResultCount, onAlgoToggle, onAlgoWeight, onToggleAutoWeight, onDelete, onEditRange }: TypeCardProps) {
  const { algorithms } = useModelLibrary();
  const [expanded, setExpanded] = useState(false);
  const bm = BUILTIN_TYPES.find(b => b.id === type.id);
  const resultPresets = bm?.resultCountPresets || [1, 3, 5, 10];
  const selectionCount = type.selectedAlgorithms.filter(sa => algorithms.find(a => a.id === sa.id)?.enabled).length;

  return (
    <div className={`border rounded-2xl transition-all ${type.enabled ? 'bg-white border-gray-200 shadow-sm' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input type="checkbox" checked={type.enabled} onChange={onToggle} className="w-4 h-4 text-indigo-600 rounded" />
            <div>
              <span className="font-medium text-gray-800 text-sm">{type.name}</span>
              {!type.isBuiltin && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">自定义</span>}
              <span className="ml-2 text-xs text-gray-400">{selectionCount}算法 · 推荐{type.resultCount}个</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onEditRange} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl" title="编辑号码映射"><Hash className="w-3.5 h-3.5" /></button>
            <button onClick={() => setExpanded(!expanded)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
            {!type.isBuiltin && (
              <button onClick={onDelete} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl"><Trash2 className="w-3.5 h-3.5" /></button>
            )}
          </div>
        </div>

        {expanded && (
          <div className="mt-3 pl-7">
            <div className="flex items-center gap-1 mb-2 flex-wrap">
              <span className="text-xs text-gray-400 mr-1">推荐数量:</span>
              {resultPresets.map(n => (
                <button key={n} onClick={() => onResultCount(n)}
                  className={`px-2 py-0.5 text-xs rounded-xl border transition-colors ${type.resultCount === n ? 'bg-indigo-100 border-indigo-300 text-indigo-700 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>{n}</button>
              ))}
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">算法</span>
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input type="checkbox" checked={type.autoWeight} onChange={onToggleAutoWeight} className="w-3 h-3 text-indigo-600 rounded" />
                  <span className="text-gray-400 text-xxs">自动</span>
                </label>
              </div>
              {algorithms.filter(a => a.enabled).map(algo => {
                const sa = type.selectedAlgorithms.find(x => x.id === algo.id);
                const checked = !!sa;
                return (
                  <div key={algo.id} className="flex items-center gap-1.5 py-0.5 px-1.5 rounded hover:bg-gray-50 transition-colors">
                    <input type="checkbox" checked={checked} disabled={!type.enabled} onChange={() => onAlgoToggle(algo.id)}
                      className="w-3 h-3 text-indigo-600 rounded flex-shrink-0" />
                    <span className={`text-[11px] flex-1 ${checked && type.enabled ? 'text-gray-600' : 'text-gray-300'}`}>
                      {ALGO_NAMES[algo.id] || algo.id}
                    </span>
                    {checked && (
                      <>
                        <input type="range" min="0" max="1" step="0.05" value={sa!.weight}
                          onChange={e => onAlgoWeight(algo.id, parseFloat(e.target.value))}
                          className="w-12 h-0.5 accent-indigo-600" disabled={!type.enabled} />
                        <span className="text-[11px] font-mono w-6 text-right text-gray-400">{sa!.weight.toFixed(2)}</span>
                        {sa?.hitRate != null && (
                          <span className={`text-[11px] ${(sa.hitRate || 0) >= 0.3 ? 'text-green-500' : (sa.hitRate || 0) >= 0.1 ? 'text-amber-500' : 'text-red-400'}`}>
                            {((sa.hitRate || 0) * 100).toFixed(0)}%
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DynamicPrediction() {
  const { data } = useData();
  const { algorithms } = useModelLibrary();

  const [types, setTypes] = useState<PredictionTypeConfig[]>(() => {
    try { const s = localStorage.getItem(TYPES_KEY); return s ? JSON.parse(s) : buildDefaultTypes(); } catch { return buildDefaultTypes(); }
  });
  const [finalCount, setFinalCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    typeResults: { typeName: string; categories: { category: string; probability: number }[] }[];
    finalNumbers: { number: number; probability: number }[]; issue: string; date: string;
  } | null>(null);
  const [records, setRecords] = useState<DynamicPredictionRecord[]>(() => {
    try { return loadFromStorage<DynamicPredictionRecord[]>(RECORDS_KEY) || []; } catch { return []; }
  });
  const [showRecords, setShowRecords] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [editingRange, setEditingRange] = useState<PredictionTypeConfig | null>(null);
  const [scriptRepoPath, setScriptRepoPath] = useState<string>(() => localStorage.getItem('script_repo_path') || DEFAULT_SCRIPT_REPO_PATH);
  const [pushMessage, setPushMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const persistTypes = (u: PredictionTypeConfig[]) => { localStorage.setItem(TYPES_KEY, JSON.stringify(u)); setTypes(u); };
  const persistRecords = (u: DynamicPredictionRecord[]) => { saveToStorage(u, RECORDS_KEY); setRecords(u); };

  useEffect(() => {
    localStorage.setItem('script_repo_path', scriptRepoPath);
  }, [scriptRepoPath]);

  // ==================== 一键推送（各类型/自定义类型 → 自动发送脚本） ====================
  const buildPushConfig = useCallback(() => {
    const enabled = types.filter(t => t.enabled);
    return {
      types: enabled.map(t => ({
        id: t.id, name: t.name, resultCount: t.resultCount, topN: computeTopN(t),
        selectedAlgorithms: t.selectedAlgorithms.map(sa => ({ id: sa.id, weight: sa.weight })),
        categories: t.categories, numberRanges: t.numberRanges,
        isBuiltin: t.isBuiltin, autoWeight: t.autoWeight,
      })),
      finalCount,
      updatedAt: new Date().toISOString(),
    };
  }, [types, finalCount]);

  const handlePushConfig = useCallback(async () => {
    setPushMessage(null);
    const enabled = types.filter(t => t.enabled);
    if (enabled.length === 0) { setPushMessage({ ok: false, text: '请至少启用一个预测类型' }); return; }
    const config = buildPushConfig();
    const repoPath = scriptRepoPath.trim();
    try {
      const res = await fetch(`${API_BASE}/api/models/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, repoPath: repoPath || undefined, autoGit: !!repoPath }),
      });
      const json = await res.json();
      setPushMessage(json.success
        ? { ok: true, text: json.message || '已推送' }
        : { ok: false, text: json.message || '推送失败' });
    } catch (e: any) {
      setPushMessage({ ok: false, text: '无法连接后端服务：' + (e?.message || '未知错误') });
    }
  }, [buildPushConfig, scriptRepoPath, types]);

  const copyPushConfig = useCallback(async () => {
    const config = buildPushConfig();
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      setPushMessage({ ok: true, text: '配置已复制到剪贴板，请保存为 scripts/predictor/config.json' });
    } catch {
      setPushMessage({ ok: false, text: '复制失败' });
    }
  }, [buildPushConfig]);

  // ==================== 命中统计（覆盖全部类型 + 综合号码） ====================
  const getActualCategory = useCallback((type: PredictionTypeConfig, rec: DrawRecord): string => {
    if (type.isBuiltin && type.id === 'zodiac') return zodiacOfRecord(rec);
    if (type.isBuiltin && type.id === 'element') return elementOfRecord(rec);
    for (let i = 0; i < type.categories.length; i++) {
      if ((type.numberRanges[i] || []).includes(rec.special)) return type.categories[i];
    }
    return '';
  }, []);

  const hitStats = useMemo(() => {
    const byIssue = new Map(data.map(d => [d.issue, d]));
    const typeMap = new Map(types.map(t => [t.id, t]));
    const acc: Record<string, { id: string; name: string; total: number; drawn: number; hits: number }> = {};
    types.forEach(t => acc[t.id] = { id: t.id, name: t.name, total: 0, drawn: 0, hits: 0 });
    records.forEach(r => {
      r.typeResults.forEach(tr => {
        const type = (tr.typeId && typeMap.get(tr.typeId)) || types.find(t => t.name === tr.typeName);
        if (!type) return;
        const s = acc[type.id];
        s.total++;
        const rec = byIssue.get(r.issue);
        if (!rec) return;
        s.drawn++;
        const actual = getActualCategory(type, rec);
        if (actual && tr.categories.some(cp => cp.category === actual)) s.hits++;
      });
    });
    return Object.values(acc);
  }, [types, records, data, getActualCategory]);

  const numberHitStats = useMemo(() => {
    const byIssue = new Map(data.map(d => [d.issue, d]));
    let total = 0, drawn = 0, hits = 0;
    records.forEach(r => {
      if (!r.finalNumbers || r.finalNumbers.length === 0) return;
      total++;
      const rec = byIssue.get(r.issue);
      if (!rec) return;
      drawn++;
      if (r.finalNumbers.some(p => p.number === rec.special)) hits++;
    });
    return { total, drawn, hits, rate: drawn > 0 ? hits / drawn : 0 };
  }, [records, data]);

  const getTypeVerdict = useCallback((tr: { typeId: string; typeName: string; categories: { category: string; probability: number }[] }, r: DynamicPredictionRecord): { actual: string; hit: boolean } | null => {
    const rec = data.find(d => d.issue === r.issue);
    if (!rec) return null;
    const type = (tr.typeId && types.find(t => t.id === tr.typeId)) || types.find(t => t.name === tr.typeName);
    if (!type) return null;
    const actual = getActualCategory(type, rec);
    if (!actual) return null;
    return { actual, hit: tr.categories.some(cp => cp.category === actual) };
  }, [data, types, getActualCategory]);

  const runPredict = useCallback(async () => {
    const et = types.filter(t => t.enabled);
    if (et.length === 0) { alert('请至少启用一个预测类型'); return; }
    setLoading(true);
    try {
      const last = data[data.length - 1];
      const seed = last ? last.issue.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0) & 0x7fffffff : 42;
      const { typeResults, finalNumbers, typeHits } = runPrediction(data, seed, algorithms, et);
      const issue = calculateNextIssue(last);
      const date = calculateNextDate(last?.date || '');
      setResult({ typeResults, finalNumbers, issue, date });
      const newRecord: DynamicPredictionRecord = {
        id: Date.now().toString(), timestamp: new Date().toISOString(), issue, date,
        typeResults: typeResults.map(tr => ({ typeId: tr.typeId, typeName: tr.typeName, categories: tr.categories })),
        finalNumbers: finalNumbers.slice(0, finalCount),
        typeHits,
      };
      const updatedRecords = [newRecord, ...records];
      persistRecords(updatedRecords);
      // 每累积 5 次预测自动调权
      if (updatedRecords.length % 5 === 0) {
        const tuned = autoTuneWeights(types, updatedRecords, data);
        persistTypes(tuned);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [data, types, algorithms, records, finalCount]);

  const doAutoTune = () => {
    const tuned = autoTuneWeights(types, records, data);
    persistTypes(tuned);
  };

  const clearRecords = () => { clearStorage(RECORDS_KEY); setRecords([]); };
  const deleteRecord = (id: string) => { persistRecords(records.filter(r => r.id !== id)); };

  // 预测记录自动按日期（升序期号=最新在前）排序
  const displayRecords = useMemo(
    () => [...records].sort((a, b) =>
      (b.date || '').localeCompare(a.date || '') || (b.timestamp || '').localeCompare(a.timestamp || '')),
    [records],
  );

  // ==================== 回测（权重寻优 + 样本外盲测 → 一键应用到模型） ====================
  const [showBacktest, setShowBacktest] = useState(false);
  const [btLookback, setBtLookback] = useState(20);
  const [btBlindN, setBtBlindN] = useState(10);
  const [btRunning, setBtRunning] = useState(false);
  const [btResults, setBtResults] = useState<TypeBacktestResult[]>([]);
  const [btError, setBtError] = useState('');
  const [btAppliedIds, setBtAppliedIds] = useState<Set<string>>(new Set());

  const handleBacktest = useCallback(() => {
    if (data.length < 30) { alert('历史数据不足（至少 30 期）'); return; }
    if (types.filter(t => t.enabled).length === 0) { alert('请至少启用一个预测类型'); return; }
    setBtRunning(true); setBtError(''); setBtResults([]); setBtAppliedIds(new Set());
    setTimeout(() => {
      try {
        const results: TypeBacktestResult[] = [];
        types.filter(t => t.enabled).forEach(t => {
          try { results.push(runTypeBacktest(data, t, algorithms, { lookback: btLookback, blindN: btBlindN })); }
          catch (err: any) { console.error(err); }
        });
        setBtResults(results);
      } catch (e: any) { setBtError(e?.message || '回测失败'); }
      setBtRunning(false);
    }, 30);
  }, [data, types, algorithms, btLookback, btBlindN]);

  const applyBacktestWeights = useCallback((res: TypeBacktestResult) => {
    persistTypes(types.map(t => {
      if (t.id !== res.typeId) return t;
      const bw = new Map(res.bestWeights.map(w => [w.id, w.weight]));
      return {
        ...t,
        selectedAlgorithms: t.selectedAlgorithms.map(sa => {
          const w = bw.get(sa.id);
          return w != null ? { ...sa, weight: parseFloat(w.toFixed(2)) } : sa;
        }),
      };
    }));
    setBtAppliedIds(prev => new Set(prev).add(res.typeId));
  }, [types]);

  const applyAllBacktestWeights = useCallback(() => {
    btResults.forEach(res => applyBacktestWeights(res));
  }, [btResults, applyBacktestWeights]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              动态预测
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">自由组建算法 → 自定义类型 → 多维度融合推荐</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePushConfig} className="px-3 py-1.5 bg-green-600 text-white rounded-xl text-xs flex items-center gap-1.5 hover:bg-green-700 transition-colors" title="将当前全部已启用的预测类型（含自定义类型）推送并提交到自动发送脚本仓库">
              <SendHorizontal className="w-3.5 h-3.5" /> 一键推送
            </button>
            <button onClick={doAutoTune} className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs flex items-center gap-1.5 hover:bg-gray-50 transition-colors" title="根据历史命中率自动调整各算法权重">
              <RefreshCw className="w-3.5 h-3.5" /> 自动调权
            </button>
            <button onClick={() => setShowBacktest(true)} className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs flex items-center gap-1.5 hover:bg-gray-50 transition-colors" title="各类型权重寻优 + 样本外盲测，结果可一键应用到对应模型">
              <BarChart3 className="w-3.5 h-3.5" /> 回测
            </button>
            <button onClick={() => setShowRecords(true)} className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs flex items-center gap-1.5 hover:bg-gray-50 transition-colors">
              <History className="w-3.5 h-3.5" /> 记录 ({records.length})
            </button>
            <button onClick={() => setShowCustom(true)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs flex items-center gap-1.5 hover:bg-indigo-700 transition-colors">
              <Plus className="w-3.5 h-3.5" /> 添加类型
            </button>
          </div>
        </div>
        {pushMessage && (
          <div className={`mb-3 text-xs ${pushMessage.ok ? 'text-green-600' : 'text-red-500'}`}>{pushMessage.text}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {types.map(type => (
            <TypeCard
              key={type.id} type={type}
              onToggle={() => persistTypes(types.map(t => t.id === type.id ? { ...t, enabled: !t.enabled } : t))}
              onResultCount={n => persistTypes(types.map(t => t.id === type.id ? { ...t, resultCount: n } : t))}
              onAlgoToggle={id => {
                const t = types.find(x => x.id === type.id); if (!t) return;
                const exists = t.selectedAlgorithms.find(sa => sa.id === id);
                const updated = exists
                  ? t.selectedAlgorithms.filter(sa => sa.id !== id)
                  : [...t.selectedAlgorithms, { id, weight: 0.25 }];
                persistTypes(types.map(x => x.id === type.id ? { ...x, selectedAlgorithms: updated } : x));
              }}
              onAlgoWeight={(id, w) => persistTypes(types.map(t => t.id === type.id ? { ...t, selectedAlgorithms: t.selectedAlgorithms.map(sa => sa.id === id ? { ...sa, weight: w } : sa) } : t))}
              onToggleAutoWeight={() => persistTypes(types.map(t => t.id === type.id ? { ...t, autoWeight: !t.autoWeight } : t))}
              onDelete={() => persistTypes(types.filter(t => t.id !== type.id))}
              onEditRange={() => setEditingRange(type)}
            />
          ))}
        </div>

        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500 font-medium block mb-1">自动发送脚本仓库路径（填了才自动 git commit + push）</label>
              <input
                value={scriptRepoPath}
                onChange={e => setScriptRepoPath(e.target.value)}
                placeholder="仓库根目录（需含 scripts/predictor/config.json）"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <p className="text-xs text-gray-400 mt-1">一键推送将当前所有已启用的预测类型（含自定义类型）写入 scripts/predictor/config.json 并提交推送</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={copyPushConfig} className="px-3 py-2 border border-gray-200 rounded-xl text-xs flex items-center gap-1.5 hover:bg-gray-50 transition-colors">
                <Copy className="w-3.5 h-3.5" /> 复制配置
              </button>
              <button onClick={handlePushConfig} className="px-4 py-2 bg-green-600 text-white rounded-xl text-xs flex items-center gap-1.5 hover:bg-green-700 transition-colors">
                <Send className="w-3.5 h-3.5" /> 一键推送
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Target className="w-4 h-4 text-orange-500" />
            命中统计 <span className="text-xs text-gray-400 font-normal">（按已开奖结果验证全部类型）</span>
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {hitStats.map(s => (
            <div key={s.id} className="border border-gray-100 rounded-2xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{s.name}</span>
                <span className={`text-xs font-semibold ${s.drawn > 0 && s.hits / s.drawn >= 0.5 ? 'text-green-600' : 'text-red-400'}`}>
                  {s.drawn > 0 ? `${((s.hits / s.drawn) * 100).toFixed(0)}%` : '--'}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-1">命中 <b>{s.hits}</b> / 已开奖 <b>{s.drawn}</b>（共预测 {s.total}）</div>
              <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                <div className={`h-full rounded-full ${s.drawn > 0 && s.hits / s.drawn >= 0.5 ? 'bg-green-500' : 'bg-red-400'}`}
                  style={{ width: `${s.drawn > 0 ? (s.hits / s.drawn) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
          <div className="border border-indigo-100 bg-indigo-50/50 rounded-2xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">综合推荐号码</span>
              <span className={`text-xs font-semibold ${numberHitStats.rate >= 0.5 ? 'text-green-600' : 'text-red-400'}`}>
                {numberHitStats.drawn > 0 ? `${(numberHitStats.rate * 100).toFixed(0)}%` : '--'}
              </span>
            </div>
            <div className="text-xs text-gray-400 mt-1">命中 <b>{numberHitStats.hits}</b> / 已开奖 <b>{numberHitStats.drawn}</b>（共预测 {numberHitStats.total}）</div>
            <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
              <div className={`h-full rounded-full ${numberHitStats.rate >= 0.5 ? 'bg-indigo-500' : 'bg-red-400'}`}
                style={{ width: `${numberHitStats.drawn > 0 ? numberHitStats.rate * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">推荐号码数量:</label>
          <input type="number" min={1} max={49} value={finalCount}
            onChange={e => setFinalCount(Math.max(1, Math.min(49, parseInt(e.target.value) || 10)))}
            className="w-16 px-2 py-1 border border-gray-200 rounded-xl text-sm text-center" />
        </div>
        <button onClick={runPredict} disabled={loading}
          className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-sm font-medium hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 flex items-center gap-2 shadow-sm transition-all">
          <Play className="w-4 h-4" /> {loading ? '预测中...' : '开始预测'}
        </button>
      </div>

      {result && (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-500" />
              各类型预测结果
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {result.typeResults.map(tr => (
                <div key={tr.typeName} className="border border-gray-100 rounded-2xl p-4 bg-gradient-to-br from-gray-50 to-white">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-amber-500" />
                    {tr.typeName}
                  </h4>
                  <div className="space-y-2">
                    {tr.categories.map(cp => (
                      <div key={cp.category} className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700 w-16 truncate">{cp.category}</span>
                        <ProbBar value={cp.probability}
                          color={tr.categories.indexOf(cp) === 0 ? 'bg-amber-500' : tr.categories.indexOf(cp) === 1 ? 'bg-indigo-400' : 'bg-blue-300'} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  第{result.issue.slice(-3)}期推荐
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{result.date} · 融合 {result.typeResults.length} 种类型</div>
              </div>
              <div className="text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-xl">推荐 {finalCount} 个号码</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {result.finalNumbers.slice(0, finalCount).map((pred, i) => (
                <div key={pred.number} className="relative">
                  <NumberBall number={pred.number} size="sm" />
                  <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-xxs w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold">{i + 1}</span>
                </div>
              ))}
            </div>
            <details className="mt-4">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">展开完整概率排名</summary>
              <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-10 gap-1 mt-3">
                {result.finalNumbers.map((pred, i) => (
                  <div key={pred.number} className="flex items-center gap-1 p-1.5 bg-gray-50 rounded-xl text-xs">
                    <span className="text-gray-400 w-3.5 text-right">{i + 1}.</span>
                    <span className="font-bold text-gray-700">{String(pred.number).padStart(2, '0')}</span>
                    <ProbBar value={pred.probability} color="bg-indigo-300" />
                  </div>
                ))}
              </div>
            </details>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-gray-500" />
                文本版结果 <span className="text-xs text-gray-400 font-normal">（可复制分享）</span>
              </h3>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 font-mono text-xs leading-relaxed text-gray-700 whitespace-pre-wrap select-all">
              {generateTextResult(result, finalCount)}
            </div>
            <button onClick={() => { navigator.clipboard.writeText(generateTextResult(result, finalCount)); }}
              className="mt-3 px-3 py-1.5 border border-gray-200 rounded-xl text-xs flex items-center gap-1.5 hover:bg-gray-50 transition-colors">
              <Copy className="w-3.5 h-3.5" /> 复制文本
            </button>
          </div>
        </>
      )}

      {!result && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-14 text-center">
          <div className="text-6xl mb-4 opacity-70">🎯</div>
          <p className="text-lg font-medium text-gray-600">配置预测类型，点击"开始预测"</p>
          <p className="text-sm text-gray-400 mt-1">自动同步最新数据 → 多算法融合 → 分类+号码双维度推荐</p>
        </div>
      )}

      <CustomTypeModal open={showCustom} onClose={() => setShowCustom(false)} onSave={cfg => { persistTypes([...types, cfg]); setShowCustom(false); }} />
      {editingRange && (
        <RangeEditor config={editingRange} onSave={u => { persistTypes(types.map(t => t.id === u.id ? u : t)); setEditingRange(null); }} onClose={() => setEditingRange(null)} />
      )}

      {showRecords && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/40" onClick={() => setShowRecords(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-500" />
                预测记录（{records.length}）
              </h3>
              <div className="flex gap-2">
                {records.length > 0 && (
                  <button onClick={clearRecords} className="text-xs text-red-500 hover:text-red-700 px-3 py-1 border border-red-200 rounded-xl hover:bg-red-50">清空全部</button>
                )}
                <button onClick={() => setShowRecords(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-xl"><X className="w-4 h-4" /></button>
              </div>
            </div>
            {records.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-sm">暂无预测记录</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {displayRecords.map(r => (
                  <div key={r.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold text-gray-800">第{r.issue.slice(-3)}期</span>
                        <span className="text-gray-400">{r.date}</span>
                        <span className="text-xs text-gray-300">{new Date(r.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <button onClick={() => deleteRecord(r.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {r.finalNumbers.map(p => <NumberBall key={p.number} number={p.number} size="xs" />)}
                    </div>
                    <div className="text-xs text-gray-400 mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      {r.typeResults.map(tr => {
                        const v = getTypeVerdict(tr, r);
                        return (
                          <span key={tr.typeId || tr.typeName} className="bg-gray-100 px-2 py-0.5 rounded-lg">
                            {tr.typeName}: {tr.categories.map(c => c.category).join('/')}
                            {v ? (
                              v.hit
                                ? <span className="text-green-600 font-bold ml-1">✓ 命中</span>
                                : <span className="text-red-500 ml-1">✗（实际 {v.actual}）</span>
                            ) : (
                              <span className="text-gray-300 ml-1">待开奖</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showBacktest && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 bg-black/40" onClick={() => setShowBacktest(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-500" />
                预测回测
                <span className="text-xs text-gray-400 font-normal">（样本内权重寻优 + 样本外盲测）</span>
              </h3>
              <button onClick={() => setShowBacktest(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-xl"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">寻优窗口（期）</label>
                  <input type="number" min={5} max={200} value={btLookback}
                    onChange={e => setBtLookback(Math.max(5, Math.min(200, parseInt(e.target.value) || 20)))}
                    className="w-24 px-2 py-1.5 border border-gray-200 rounded-xl text-sm text-center" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">盲测期数（样本外）</label>
                  <input type="number" min={0} max={100} value={btBlindN}
                    onChange={e => setBtBlindN(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                    className="w-24 px-2 py-1.5 border border-gray-200 rounded-xl text-sm text-center" />
                </div>
                <button onClick={handleBacktest} disabled={btRunning}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {btRunning ? '回测中...' : '开始回测'}
                </button>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                对每个已启用类型：在最近 N 期滚动窗口内搜索最优算法权重组合（每期训练只用该期之前的数据，融合结果 Top{`{N}`} 命中率最大化），再用最优组合在其后的盲测区逐期验证。回测数值可一键写入对应类型的算法权重。
              </p>

              {btError && <div className="text-sm text-red-500">{btError}</div>}

              {btResults.length > 0 && !btRunning && (
                <div className="flex justify-end">
                  <button onClick={applyAllBacktestWeights} className="px-4 py-1.5 bg-green-600 text-white rounded-xl text-xs hover:bg-green-700 flex items-center gap-1.5">
                    <SendHorizontal className="w-3.5 h-3.5" /> 全部应用到对应模型
                  </button>
                </div>
              )}

              {btRunning && (
                <div className="py-8 text-center text-sm text-gray-500">正在对全部启用类型进行权重寻优与盲测…</div>
              )}

              {!btRunning && btResults.map(res => {
                const applied = btAppliedIds.has(res.typeId);
                return (
                  <div key={res.typeId} className={`border rounded-2xl p-4 ${applied ? 'border-green-200 bg-green-50/40' : 'border-gray-100'}`}>
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800 text-sm">{res.typeName}</span>
                        <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg">Top{res.topN}</span>
                        <span className="text-xs text-gray-400">{res.totalCombos} 组权重 · 寻优 {res.searchTotal} 期</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {applied && <span className="text-xs text-green-600 font-medium">✓ 已应用</span>}
                        <button onClick={() => applyBacktestWeights(res)}
                          className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors ${applied ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                          <SendHorizontal className="w-3.5 h-3.5" /> 应用到该类型
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                      <div className="bg-gray-50 rounded-xl p-2.5">
                        <div className="text-xs text-gray-400 mb-0.5">样本内 TopN 命中</div>
                        <div className="text-base font-bold text-gray-800">
                          {res.searchHits}/{res.searchTotal}
                          <span className="text-xs font-medium text-gray-500 ml-1">({(res.bestHitRate * 100).toFixed(0)}%)</span>
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-2.5">
                        <div className="text-xs text-gray-400 mb-0.5">盲测命中（样本外）</div>
                        <div className={`text-base font-bold ${res.blindTotal > 0 && res.blindHits / res.blindTotal >= res.bestHitRate ? 'text-green-600' : res.blindTotal > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                          {res.blindTotal > 0 ? `${res.blindHits}/${res.blindTotal}` : '--'}
                          {res.blindTotal > 0 && <span className="text-xs font-medium text-gray-500 ml-1">({((res.blindHits / res.blindTotal) * 100).toFixed(0)}%)</span>}
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-2.5 col-span-2 sm:col-span-1">
                        <div className="text-xs text-gray-400 mb-1">最优权重（应用后生效）</div>
                        <div className="flex flex-wrap gap-1">
                          {res.bestWeights.filter(w => w.weight > 0).sort((a, b) => b.weight - a.weight).map(w => (
                            <span key={w.id} className="text-[11px] bg-white border border-gray-200 px-1.5 py-0.5 rounded-lg whitespace-nowrap">
                              {ALGO_NAMES[w.id] || w.id} {(w.weight * 100).toFixed(0)}%
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {res.blindTotal > 0 && (
                      <details>
                        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">盲测明细（{res.blindTotal} 期，最新在后）</summary>
                        <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                          {[...res.blindDetails].reverse().map((d, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 rounded-lg bg-gray-50">
                              <span className="text-gray-500 shrink-0">第{d.issue}期</span>
                              <span className="font-mono text-gray-600 truncate flex-1">{d.predicted.join(' ')}</span>
                              <span className="text-gray-400 shrink-0">实际 {d.actual}</span>
                              {d.hit
                                ? <span className="text-green-600 font-bold shrink-0">✓</span>
                                : <span className="text-red-400 shrink-0">✗</span>}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}

              {!btRunning && btResults.length === 0 && !btError && (
                <div className="py-8 text-center text-sm text-gray-400">设置参数后点击「开始回测」</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
