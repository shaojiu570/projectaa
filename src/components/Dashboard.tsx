import { useMemo } from 'react';
import { DrawRecord } from '../data/types';
import { useMapping } from '../stores/MappingContext';
import { getParity, getSize, ZODIACS } from '../constants/index';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Database, TrendingUp, Hash, Calendar } from 'lucide-react';
import NumberBall from './NumberBall';
import React from 'react';

interface Props {
  data: DrawRecord[];
}

function Dashboard({ data }: Props) {
  const { getZodiac, getColor, getElement, getZodiacByDateAndNumber } = useMapping();
  const stats = useMemo(() => {
    const recent = data.slice(-30);
    const last = data[data.length - 1];

    // Frequency of each number
    const freq = new Array(49).fill(0);
    data.forEach(d => { freq[d.special - 1]++; });

    // Recent frequency
    const recentFreq = new Array(49).fill(0);
    recent.forEach(d => { recentFreq[d.special - 1]++; });

    // Hot/Cold numbers
    const sorted = Array.from({ length: 49 }, (_, i) => ({ num: i + 1, freq: recentFreq[i] }))
      .sort((a, b) => b.freq - a.freq);
    const hotNumbers = sorted.slice(0, 10);
    const coldNumbers = sorted.slice(-10).reverse();

    // Zodiac frequency (recent)
    const zodiacFreq: Record<string, number> = {};
    ZODIACS.forEach(z => { zodiacFreq[z] = 0; });
    recent.forEach(d => {
      const z = getZodiacByDateAndNumber(d.date, d.special);
      zodiacFreq[z] = (zodiacFreq[z] || 0) + 1;
    });

    // Color frequency (recent)
    const colorFreq: Record<string, number> = { '红波': 0, '蓝波': 0, '绿波': 0 };
    recent.forEach(d => {
      const c = getColor(d.special);
      colorFreq[c] = (colorFreq[c] || 0) + 1;
    });

    // Parity and size
    let oddCount = 0, bigCount = 0;
    recent.forEach(d => {
      if (getParity(d.special) === '奇') oddCount++;
      if (getSize(d.special) === '大') bigCount++;
    });

    // Missing periods for each number
    const missing = new Array(49).fill(0);
    for (let i = 0; i < 49; i++) {
      let gap = 0;
      for (let j = data.length - 1; j >= 0; j--) {
        if (data[j].special === i + 1) break;
        gap++;
      }
      missing[i] = gap;
    }
    const topMissing = Array.from({ length: 49 }, (_, i) => ({ num: i + 1, gap: missing[i] }))
      .sort((a, b) => b.gap - a.gap).slice(0, 10);

    return { last, recent, freq, recentFreq, hotNumbers, coldNumbers, zodiacFreq, colorFreq, oddCount, bigCount, topMissing };
  }, [data]);

  const zodiacData = ZODIACS.map(z => ({ name: z, value: stats.zodiacFreq[z] || 0 }));
  const colorData = [
    { name: '红波', value: stats.colorFreq['红波'], color: '#ef4444' },
    { name: '蓝波', value: stats.colorFreq['蓝波'], color: '#3b82f6' },
    { name: '绿波', value: stats.colorFreq['绿波'], color: '#22c55e' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Database className="w-5 h-5" />}
          label="总数据量"
          value={`${data.length} 期`}
          sub={`${data[0]?.date} ~ ${data[data.length - 1]?.date}`}
          color="blue"
        />
        <StatCard
          icon={<Hash className="w-5 h-5" />}
          label="最新一期"
          value={`第${stats.last?.issue?.slice(-3)}期`}
          sub={`${stats.last?.date} · 特码: ${stats.last?.special}`}
          color="red"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="近30期奇偶比"
          value={`${stats.oddCount}:${30 - stats.oddCount}`}
          sub={`奇数占比 ${((stats.oddCount / 30) * 100).toFixed(1)}%`}
          color="purple"
        />
        <StatCard
          icon={<Calendar className="w-5 h-5" />}
          label="近30期大小比"
          value={`${stats.bigCount}:${30 - stats.bigCount}`}
          sub={`大数占比 ${((stats.bigCount / 30) * 100).toFixed(1)}%`}
          color="green"
        />
      </div>

      {/* Latest Draw */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          最新开奖 - 第{stats.last?.issue?.slice(-3)}期 ({stats.last?.date})
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          {stats.last?.normals.map((n, i) => (
            <NumberBall key={i} number={n} size="lg" />
          ))}
          <span className="text-2xl text-gray-300 mx-2">+</span>
          <NumberBall number={stats.last?.special || 1} size="lg" highlight />
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-600">
          <span>生肖: <b>{getZodiac(stats.last?.special || 1)}</b></span>
          <span>波色: <b>{getColor(stats.last?.special || 1)}</b></span>
          <span>五行: <b>{getElement(stats.last?.special || 1, new Date(stats.last?.date || '').getFullYear())}</b></span>
          <span>奇偶: <b>{getParity(stats.last?.special || 1)}</b></span>
          <span>大小: <b>{getSize(stats.last?.special || 1)}</b></span>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hot Numbers */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">🔥 近30期热号 Top 10</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {stats.hotNumbers.map(h => (
              <div key={h.num} className="flex flex-col items-center">
                <NumberBall number={h.num} size="md" />
                <span className="text-xs text-gray-500 mt-1">{h.freq}次</span>
              </div>
            ))}
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 mt-4">❄️ 近30期冷号 Top 10</h3>
          <div className="flex flex-wrap gap-2">
            {stats.coldNumbers.map(c => (
              <div key={c.num} className="flex flex-col items-center">
                <NumberBall number={c.num} size="md" />
                <span className="text-xs text-gray-500 mt-1">{c.freq}次</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Missing */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">⏳ 最大遗漏值 Top 10</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.topMissing} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="num" type="category" width={40} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => [`${v} 期`, '遗漏']} />
              <Bar dataKey="gap" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Zodiac & Color Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">🐲 近30期生肖分布</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={zodiacData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">🎨 近30期波色分布</h3>
          <div className="flex justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={colorData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {colorData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <div className="text-xl font-bold text-gray-800">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{sub}</div>
    </div>
  );
}

export default React.memo(Dashboard);
