import { useState } from 'react';
import { DrawRecord } from '../data/types';
import MarkovAnalysis from './analysis/MarkovAnalysis';
import TrendAnalysis from './analysis/TrendAnalysis';
import FeatureAnalysis from './analysis/FeatureAnalysis';

interface Props {
  data: DrawRecord[];
}

const TABS = [
  { key: 'markov' as const, label: '马尔可夫分析', icon: '🔗' },
  { key: 'trend' as const, label: '走势分析', icon: '📈' },
  { key: 'features' as const, label: '特征分析', icon: '🧮' },
];

export default function Analysis({ data }: Props) {
  const [activeTab, setActiveTab] = useState<'markov' | 'trend' | 'features'>('markov');

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 bg-white rounded-xl shadow-sm border border-gray-200 p-1.5">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'markov' && <MarkovAnalysis data={data} />}
      {activeTab === 'trend' && <TrendAnalysis data={data} />}
      {activeTab === 'features' && <FeatureAnalysis data={data} />}
    </div>
  );
}
