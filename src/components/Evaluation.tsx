import { useState, useCallback } from 'react';
import { DrawRecord } from '../data/types';
import { runBacktest, BacktestResult, DEFAULT_CONFIG } from '../utils/prediction';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Play, CheckCircle, XCircle } from 'lucide-react';

interface Props {
  data: DrawRecord[];
}

export default function Evaluation({ data }: Props) {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [testSize, setTestSize] = useState(50);
  const [progress, setProgress] = useState(0);

  const runTest = useCallback(() => {
    setLoading(true);
    setProgress(0);
    
    // Simulate progress
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 95) {
          clearInterval(interval);
          return p;
        }
        return p + Math.random() * 15;
      });
    }, 200);

    setTimeout(() => {
      const res = runBacktest(data, DEFAULT_CONFIG, testSize);
      setResult(res);
      setLoading(false);
      setProgress(100);
      clearInterval(interval);
    }, 2000);
  }, [data, testSize]);

  const hitRateData = result ? [
    { name: 'Top-1', rate: (result.top1Hits / result.total) * 100, baseline: 2.04 },
    { name: 'Top-3', rate: (result.top3Hits / result.total) * 100, baseline: 6.12 },
    { name: 'Top-5', rate: (result.top5Hits / result.total) * 100, baseline: 10.2 },
    { name: 'Top-10', rate: (result.top10Hits / result.total) * 100, baseline: 20.4 },
  ] : [];

  const recallData = result ? [
    { name: 'S1层', rate: (result.s1Recalls / result.total) * 100 },
    { name: 'S2层', rate: (result.s2Recalls / result.total) * 100 },
    { name: 'S3层', rate: (result.s3Recalls / result.total) * 100 },
  ] : [];

  const radarData = result ? [
    { metric: 'Top-1', value: (result.top1Hits / result.total) * 100 },
    { metric: 'Top-3', value: (result.top3Hits / result.total) * 100 },
    { metric: 'Top-5', value: (result.top5Hits / result.total) * 100 },
    { metric: 'Top-10', value: (result.top10Hits / result.total) * 100 },
    { metric: '生肖准确', value: result.zodiacAccuracy * 100 },
    { metric: '波色准确', value: result.colorAccuracy * 100 },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Control */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">离线回测评估</h3>
            <p className="text-sm text-gray-500">对历史数据进行滚动回测，评估模型预测准确率</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">测试期数:</label>
              <select
                value={testSize}
                onChange={e => setTestSize(Number(e.target.value))}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
              >
                <option value={20}>20期</option>
                <option value={50}>50期</option>
                <option value={100}>100期</option>
              </select>
            </div>
            <button
              onClick={runTest}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-5 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Play className="w-4 h-4" />
              {loading ? '回测中...' : '开始回测'}
            </button>
          </div>
        </div>

        {loading && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-500 mb-1">
              <span>回测进度</span>
              <span>{progress.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Top-1 命中', value: result.top1Hits, total: result.total, baseline: 2.04 },
              { label: 'Top-3 命中', value: result.top3Hits, total: result.total, baseline: 6.12 },
              { label: 'Top-5 命中', value: result.top5Hits, total: result.total, baseline: 10.2 },
              { label: 'Top-10 命中', value: result.top10Hits, total: result.total, baseline: 20.4 },
            ].map(card => {
              const rate = (card.value / card.total) * 100;
              const better = rate > card.baseline;
              return (
                <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">{card.label}</span>
                    {better ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                  <div className="text-2xl font-bold text-gray-800">
                    {card.value}/{card.total}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-sm font-medium ${better ? 'text-green-600' : 'text-red-500'}`}>
                      {rate.toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-400">
                      基线: {card.baseline}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hit Rate Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">命中率 vs 随机基线</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hitRateData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}%`, '']} />
                  <Bar dataKey="rate" fill="#6366f1" name="模型命中率" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="baseline" fill="#d1d5db" name="随机基线" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Radar Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">综合评估雷达图</h3>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar name="评分" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Funnel Recall */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">各层召回率</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {recallData.map(r => (
                <div key={r.name} className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-indigo-600">{r.rate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-500 mt-1">{r.name} 召回率</div>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={recallData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="name" type="category" width={50} />
                <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}%`, '召回率']} />
                <Bar dataKey="rate" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Attribute Accuracy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-3">生肖预测准确率</h3>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold text-purple-600">
                  {(result.zodiacAccuracy * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-500">
                  <div>基线: {(3 / 12 * 100).toFixed(1)}% (随机3选12)</div>
                  <div className={result.zodiacAccuracy > 3 / 12 ? 'text-green-600' : 'text-red-500'}>
                    {result.zodiacAccuracy > 3 / 12 ? '✓ 优于基线' : '✗ 低于基线'}
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-3">波色预测准确率</h3>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold text-pink-600">
                  {(result.colorAccuracy * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-500">
                  <div>基线: 33.3% (随机1选3)</div>
                  <div className={result.colorAccuracy > 1 / 3 ? 'text-green-600' : 'text-red-500'}>
                    {result.colorAccuracy > 1 / 3 ? '✓ 优于基线' : '✗ 低于基线'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!result && !loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-400">
          <div className="text-5xl mb-4">📊</div>
          <p className="text-lg">点击"开始回测"评估预测模型性能</p>
          <p className="text-sm mt-2">将对最后 {testSize} 期数据进行滚动回测</p>
        </div>
      )}
    </div>
  );
}
