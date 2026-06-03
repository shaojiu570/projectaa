import { useMemo } from 'react';
import { DrawRecord } from '../../data/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { getParity, getSize, getTailNumber, getComposite } from '../../constants';

interface FeatureAnalysisProps {
  data: DrawRecord[];
}

const FEATURES = [
  { name: '基础时序特征', items: ['滑动窗口(K=30)', '差分特征(lag=1,2)', '移动平均(5/10/20)'], status: 'active' },
  { name: '号码属性特征', items: ['奇偶', '大小', '尾数', '合数', '波色', '生肖', '五行'], status: 'active' },
  { name: '统计特征', items: ['遗漏值(49维)', '频率/冷热号', '平均遗漏', '出现概率'], status: 'active' },
  { name: '平码特征', items: ['平码序列嵌入', '和值/均值/标准差', '奇偶/大小计数', '平码遗漏'], status: 'active' },
  { name: '高级特征', items: ['转移特征', '跨度', '农历月/日', '干支纪年'], status: 'partial' },
  { name: '特征预处理', items: ['Z-score归一化', '嵌入编码', '特征拼接', '缓存机制'], status: 'active' },
];

export default function FeatureAnalysis({ data }: FeatureAnalysisProps) {
  const featureData = useMemo(() => {
    const recent = data.slice(-50);
    return {
      parity: recent.map((d, i) => ({ index: i, value: getParity(d.special) === '奇' ? 1 : 0 })),
      size: recent.map((d, i) => ({ index: i, value: getSize(d.special) === '大' ? 1 : 0 })),
      tail: recent.map((d, i) => ({ index: i, value: getTailNumber(d.special) })),
      composite: recent.map((d, i) => ({ index: i, value: getComposite(d.special) })),
    };
  }, [data]);

  const tailDistribution = useMemo(() => {
    const counts = new Array(10).fill(0);
    featureData.tail.forEach(d => { counts[d.value]++; });
    return counts.map((c, i) => ({ tail: i, count: c }));
  }, [featureData]);

  const compositeDistribution = useMemo(() => {
    const counts: Record<number, number> = {};
    featureData.composite.forEach(d => { counts[d.value] = (counts[d.value] || 0) + 1; });
    return Object.entries(counts)
      .map(([k, v]) => ({ composite: Number(k), count: v }))
      .sort((a, b) => a.composite - b.composite);
  }, [featureData]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">尾数分布（近50期）</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={tailDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="tail" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#ec4899" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">合数分布（近50期）</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={compositeDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="composite" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">奇偶走势（近50期）</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={featureData.parity}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="index" tick={{ fontSize: 10 }} />
              <YAxis ticks={[0, 1]} tickFormatter={v => (v === 1 ? '奇' : '偶')} />
              <Tooltip formatter={v => [v === 1 ? '奇数' : '偶数', '奇偶']} />
              <Line type="stepAfter" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">大小走势（近50期）</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={featureData.size}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="index" tick={{ fontSize: 10 }} />
              <YAxis ticks={[0, 1]} tickFormatter={v => (v === 1 ? '大' : '小')} />
              <Tooltip formatter={v => [v === 1 ? '大(25-49)' : '小(1-24)', '大小']} />
              <Line type="stepAfter" dataKey="value" stroke="#22c55e" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">特征工程体系</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(feat => (
            <div key={feat.name} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-800">{feat.name}</h4>
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    feat.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {feat.status === 'active' ? '已启用' : '部分启用'}
                </span>
              </div>
              <ul className="space-y-1">
                {feat.items.map((item, i) => (
                  <li key={i} className="text-xs text-gray-500 flex items-center gap-1">
                    <span className="w-1 h-1 bg-indigo-400 rounded-full"></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
