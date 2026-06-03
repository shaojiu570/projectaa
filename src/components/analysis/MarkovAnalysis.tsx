import { useState } from 'react';
import { DrawRecord } from '../../data/types';
import { computeAllMarkov, StateGroup } from '../../utils/markov';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface MarkovAnalysisProps {
  data: DrawRecord[];
}

export default function MarkovAnalysis({ data }: MarkovAnalysisProps) {
  const [selectedGroup, setSelectedGroup] = useState<StateGroup>('生肖');
  const [showMatrix, setShowMatrix] = useState(false);
  const markovResults = computeAllMarkov(data);
  const selectedMarkov = markovResults.find(m => m.stateGroup === selectedGroup)!;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {(['生肖', '波色', '大小', '奇偶', '五行'] as StateGroup[]).map(g => (
          <button
            key={g}
            onClick={() => setSelectedGroup(g)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedGroup === g
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {selectedMarkov.stateGroup} 状态转移分析
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">状态数量</span>
              <span className="font-bold text-gray-800">{selectedMarkov.states.length}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">当前状态</span>
              <span className="font-bold text-indigo-600">{selectedMarkov.currentState}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">卡方统计量</span>
              <span className="font-bold text-gray-800">{selectedMarkov.chiSquare.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">马氏性检验</span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  selectedMarkov.isMarkov ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {selectedMarkov.isMarkov ? '✓ 通过' : '✗ 未通过'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">下期预测概率</h3>
          <div className="space-y-2">
            {selectedMarkov.predictions.map((p, i) => (
              <div key={p.state} className="flex items-center gap-3">
                <span className="w-12 text-sm font-medium text-gray-700">{p.state}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                  <div
                    className="h-full rounded-full flex items-center px-2 text-xs font-medium text-white"
                    style={{
                      width: `${Math.max(p.probability * 100, 5)}%`,
                      backgroundColor:
                        i === 0 ? '#6366f1' : i === 1 ? '#8b5cf6' : i === 2 ? '#a78bfa' : '#c4b5fd',
                    }}
                  >
                    {(p.probability * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <button
          onClick={() => setShowMatrix(!showMatrix)}
          className="w-full flex items-center justify-between"
        >
          <h3 className="text-lg font-semibold text-gray-800">转移概率矩阵</h3>
          {showMatrix ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>
        {showMatrix && (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="p-2 text-left bg-gray-50">从 ↓ / 到 →</th>
                  {selectedMarkov.states.map(s => (
                    <th key={s} className="p-2 text-center bg-gray-50 font-medium">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedMarkov.states.map((fromState, i) => (
                  <tr key={fromState}>
                    <td className="p-2 font-medium bg-gray-50 border-r border-gray-200">{fromState}</td>
                    {selectedMarkov.transitionMatrix[i].map((prob, j) => {
                      const intensity = prob;
                      return (
                        <td
                          key={j}
                          className="p-2 text-center font-mono"
                          style={{
                            backgroundColor: `rgba(99, 102, 241, ${intensity * 0.8})`,
                            color: intensity > 0.3 ? 'white' : '#374151',
                          }}
                        >
                          {(prob * 100).toFixed(1)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">各状态组综合预测</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {markovResults.map(mr => (
            <div key={mr.stateGroup} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-800">{mr.stateGroup}</h4>
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    mr.isMarkov ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {mr.isMarkov ? '马氏' : '弱马氏'}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                当前: <b>{mr.currentState}</b>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                预测Top-3:
                {mr.predictions.slice(0, 3).map((p, i) => (
                  <span key={i} className="ml-1">
                    <b>{p.state}</b>({(p.probability * 100).toFixed(0)}%)
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
