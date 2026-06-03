import { useMemo } from 'react';
import { DrawRecord } from '../../data/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface TrendAnalysisProps {
  data: DrawRecord[];
}

export default function TrendAnalysis({ data }: TrendAnalysisProps) {
  const trendData = useMemo(() => {
    const recent = data.slice(-100);
    return recent.map((d, i) => ({
      index: i,
      issue: d.issue,
      special: d.special,
      ma5: i >= 4 ? recent.slice(i - 4, i + 1).reduce((s, r) => s + r.special, 0) / 5 : null,
      ma10: i >= 9 ? recent.slice(i - 9, i + 1).reduce((s, r) => s + r.special, 0) / 10 : null,
      ma20: i >= 19 ? recent.slice(i - 19, i + 1).reduce((s, r) => s + r.special, 0) / 20 : null,
    }));
  }, [data]);

  const diffData = useMemo(() => {
    const recent = data.slice(-50);
    return recent.slice(1).map((d, i) => ({
      index: i,
      value: d.special - recent[i].special,
    }));
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">特码走势图（近100期）</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="index" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 50]} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload?.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white p-3 rounded-lg shadow-lg border text-sm">
                      <div className="font-medium">期数: {d.issue}</div>
                      <div>
                        特码: <b>{d.special}</b>
                      </div>
                      {d.ma5 && <div className="text-blue-500">MA5: {d.ma5.toFixed(1)}</div>}
                      {d.ma10 && <div className="text-green-500">MA10: {d.ma10.toFixed(1)}</div>}
                      {d.ma20 && <div className="text-orange-500">MA20: {d.ma20.toFixed(1)}</div>}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line type="monotone" dataKey="special" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} name="特码" />
            <Line type="monotone" dataKey="ma5" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="MA5" strokeDasharray="5 5" />
            <Line type="monotone" dataKey="ma10" stroke="#22c55e" strokeWidth={1.5} dot={false} name="MA10" strokeDasharray="5 5" />
            <Line type="monotone" dataKey="ma20" stroke="#f97316" strokeWidth={1.5} dot={false} name="MA20" strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-3 justify-center text-sm">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-indigo-500 inline-block"></span> 特码
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-blue-500 inline-block border-dashed"></span> MA5
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-green-500 inline-block"></span> MA10
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-orange-500 inline-block"></span> MA20
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">期间差值分布（近50期）</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={diffData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="index" tick={{ fontSize: 10 }} />
            <YAxis />
            <Tooltip formatter={v => [`${v}`, '差值']} />
            <Bar dataKey="value" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
