import { useState } from 'react';
import { DataProvider, useData } from './stores/DataContext';
import { MappingProvider } from './stores/MappingContext';
import { ModelProvider } from './stores/ModelContext';
import { FunnelProvider } from './stores/FunnelContext';
import { PredictionHistoryProvider } from './stores/PredictionHistoryContext';
import { SeparatedModelProvider } from './stores/SeparatedModelContext';
import Dashboard from './components/Dashboard';
import SeparatedPredictionPanel from './components/SeparatedPredictionPanel';
import History from './components/History';
import Analysis from './components/Analysis';
import Config from './components/Config';
import StartupStatus from './components/StartupStatus';
import { LayoutDashboard, Clock, BarChart3, Settings, Zap, CheckCircle, Brain } from 'lucide-react';

type Tab = 'dashboard' | 'predict' | 'history' | 'analysis' | 'config';

function AppInner() {
  const { data } = useData();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [flashMessage, setFlashMessage] = useState('');
  const [backendReady, setBackendReady] = useState(false);

  const onFlash = (msg: string) => {
    setFlashMessage(msg);
    setTimeout(() => setFlashMessage(''), 3000);
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'dashboard', label: '数据总览', icon: <LayoutDashboard className="w-4 h-4" /> },
    { key: 'predict', label: '智能预测', icon: <Zap className="w-4 h-4" /> },
    { key: 'history', label: '历史数据', icon: <Clock className="w-4 h-4" /> },
    { key: 'analysis', label: '统计分析', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'config', label: '系统配置', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {!backendReady ? (
        <StartupStatus onBackendReady={() => setBackendReady(true)} />
      ) : (
        <>
          {/* Flash Notification */}
          {flashMessage && (
            <div className="fixed top-20 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-right duration-300">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">{flashMessage}</span>
            </div>
          )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800 leading-tight">六合彩特码预测系统</h1>
                <p className="text-xs text-gray-400">AI多模型融合 · 漏斗式推理引擎 v4.0</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-gray-400">
              <span className="px-2 py-1 bg-green-50 text-green-600 rounded-full font-medium">● 本地运行</span>
              <span>数据: {data.length}期</span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-16 z-30 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 py-2">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'dashboard' && <Dashboard data={data} />}
        {activeTab === 'predict' && <SeparatedPredictionPanel />}
        {activeTab === 'history' && <History />}
        {activeTab === 'analysis' && <Analysis data={data} />}
        {activeTab === 'config' && <Config />}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
            <span>六合彩特码预测系统 v4.0 · 组合方案</span>
            <span>⚠️ 仅供技术研究，不构成投资建议</span>
            <span>多模型融合 + 马尔可夫链 + 漏斗推理</span>
          </div>
        </div>
      </footer>
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <MappingProvider>
        <ModelProvider>
          <FunnelProvider>
            <PredictionHistoryProvider>
              <SeparatedModelProvider>
                <AppInner />
              </SeparatedModelProvider>
            </PredictionHistoryProvider>
          </FunnelProvider>
        </ModelProvider>
      </MappingProvider>
    </DataProvider>
  );
}
