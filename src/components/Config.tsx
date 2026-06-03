import { useState, useEffect } from 'react';
import { useMapping } from '../stores/MappingContext';
import {
  ZODIACS
} from '../constants/index';
import { Settings, Save, RotateCcw, Globe, Shield, LayoutGrid, Calendar, Info, CheckCircle, Sliders, Brain } from 'lucide-react';
import CrawlerPanel from './crawler/CrawlerPanel';

const ZODIAC_EMOJI: Record<string, string> = {
  '鼠':'🐭','牛':'🐮','虎':'🐯','兔':'🐰','龙':'🐲','蛇':'🐍',
  '马':'🐴','羊':'🐑','猴':'🐵','鸡':'🐔','狗':'🐶','猪':'🐷',
};

export default function Config() {
  const [activeTab, setActiveTab] = useState<'system' | 'mapping' | 'year' | 'crawler' | 'model' | 'feature' | 'training'>('system');
  const [systemConfig, setSystemConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Mapping Context
  const {
    currentYear, setCurrentYear,
    yearZodiacMaps,
    zodiacNumbers, setZodiacNumbers,
    colorNumbers, setColorNumbers,
    zodiacElement, setZodiacElement,
    resetMappings,
    updateYearZodiacMap,
  } = useMapping();

  // Local editing states for mapping tables
  const [editZodiac, setEditZodiac] = useState<Record<string, string>>({});
  const [editColor, setEditColor] = useState<Record<string, string>>({});
  const [editElement, setEditElement] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchSystemConfig();
    // Initialize mapping edit states
    setEditZodiac(Object.fromEntries(Object.entries(zodiacNumbers).map(([k, v]) => [k, v.join(',')])));
    setEditColor(Object.fromEntries(Object.entries(colorNumbers).map(([k, v]) => [k, v.join(',')])));
    setEditElement({ ...zodiacElement });
  }, []);

  const fetchSystemConfig = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/config', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (data.success) setSystemConfig(data.data);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSystem = async () => {
    setSaving(true);
    try {
      const res = await fetch('http://localhost:3001/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(systemConfig)
      });
      const data = await res.json();
      if (data.success) {
        onFlash('系统设置保存成功');
      }
    } finally {
      setSaving(false);
    }
  };

  const onFlash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const saveZodiacMapping = () => {
    const newMap: Record<string, number[]> = {};
    for (const z of ZODIACS) {
      const nums = (editZodiac[z] || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      newMap[z] = nums;
    }
    setZodiacNumbers(newMap);
    onFlash('生肖映射已保存');
  };

  const saveColorMapping = () => {
    const newMap: Record<string, number[]> = {};
    for (const c of ['红波', '蓝波', '绿波']) {
      const nums = (editColor[c] || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      newMap[c] = nums;
    }
    setColorNumbers(newMap);
    onFlash('波色映射已保存');
  };

  const saveElementMapping = () => {
    setZodiacElement({ ...editElement });
    onFlash('五行映射已保存');
  };

  if (loading) return <div className="p-8 text-center">加载配置中...</div>;

  const tabs: { key: typeof activeTab; label: string; icon: any }[] = [
    { key: 'system', label: '系统设置', icon: Settings },
    { key: 'crawler', label: '数据爬取', icon: Globe },
    { key: 'mapping', label: '生肖映射', icon: LayoutGrid },
    { key: 'year', label: '年份设置', icon: Calendar },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {message && (
        <div className="bg-green-100 text-green-700 p-3 rounded-lg text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="w-4 h-4" /> {message}
        </div>
      )}

      {/* Tab Content */}
      <div className="animate-in fade-in duration-300">
        {activeTab === 'system' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-500" /> 后端系统参数
              </h2>
              <button
                onClick={handleSaveSystem}
                disabled={saving}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 disabled:bg-gray-400 transition"
              >
                {saving ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                保存系统设置
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                <h3 className="font-semibold flex items-center gap-2 text-gray-800">
                  <Globe className="w-5 h-5 text-blue-500" /> 默认爬虫设置
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">默认抓取源</label>
                    <input
                      type="text"
                      value={systemConfig?.crawler?.defaultSource || ''}
                      onChange={(e) => setSystemConfig({ ...systemConfig, crawler: { ...systemConfig.crawler, defaultSource: e.target.value } })}
                      className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500 block mb-1">最小延迟 (ms)</label>
                      <input
                        type="number"
                        value={systemConfig?.crawler?.delay?.min || 2000}
                        onChange={(e) => setSystemConfig({ ...systemConfig, crawler: { ...systemConfig.crawler, delay: { ...systemConfig.crawler.delay, min: parseInt(e.target.value) } } })}
                        className="w-full border rounded-md px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-500 block mb-1">最大延迟 (ms)</label>
                      <input
                        type="number"
                        value={systemConfig?.crawler?.delay?.max || 5000}
                        onChange={(e) => setSystemConfig({ ...systemConfig, crawler: { ...systemConfig.crawler, delay: { ...systemConfig.crawler.delay, max: parseInt(e.target.value) } } })}
                        className="w-full border rounded-md px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                <h3 className="font-semibold flex items-center gap-2 text-gray-800">
                  <Shield className="w-5 h-5 text-green-500" /> 存储与安全
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">数据库路径 (只读)</label>
                    <input
                      type="text"
                      value={systemConfig?.server?.dbPath || ''}
                      disabled
                      className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">网络超时时间 (ms)</label>
                    <input
                      type="number"
                      value={systemConfig?.crawler?.timeout || 30000}
                      onChange={(e) => setSystemConfig({ ...systemConfig, crawler: { ...systemConfig.crawler, timeout: parseInt(e.target.value) } })}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'crawler' && <CrawlerPanel onFlash={onFlash} />}

        {activeTab === 'mapping' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-indigo-500" /> 生肖-号码映射 ({currentYear}年)
                </h3>
                <button onClick={saveZodiacMapping} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition">
                  <Save className="w-4 h-4" /> 保存生肖映射
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ZODIACS.map(z => (
                  <div key={z} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-2xl shrink-0">{ZODIAC_EMOJI[z]}</span>
                    <span className="text-sm font-bold text-gray-700 w-8">{z}</span>
                    <input
                      type="text"
                      value={editZodiac[z] || ''}
                      onChange={e => setEditZodiac(prev => ({ ...prev, [z]: e.target.value }))}
                      className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-500" /> 波色与五行映射
                </h3>
                <div className="flex gap-2">
                   <button onClick={saveColorMapping} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">保存波色</button>
                   <button onClick={saveElementMapping} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">保存五行</button>
                </div>
              </div>
              <div className="space-y-4">
                {['红波', '蓝波', '绿波'].map(c => (
                  <div key={c} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-sm font-bold text-gray-700 w-12">{c}</span>
                    <input
                      type="text"
                      value={editColor[c] || ''}
                      onChange={e => setEditColor(prev => ({ ...prev, [c]: e.target.value }))}
                      className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'year' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
             <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
               <Calendar className="w-5 h-5 text-indigo-500" /> 默认年份设置
             </h3>
             <div className="flex items-center gap-4 mb-6">
               <label className="text-sm text-gray-600">选择当前年份:</label>
               <select
                 value={currentYear}
                 onChange={(e) => setCurrentYear(Number(e.target.value))}
                 className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
               >
                 {[2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                   <option key={y} value={y}>{y}年</option>
                 ))}
               </select>
               <button
                 onClick={() => {
                   resetMappings();
                   onFlash('已重置为系统默认映射');
                 }}
                 className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50"
               >
                 <RotateCcw className="w-4 h-4 inline mr-1" /> 重置全部映射
               </button>
             </div>
             <p className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg border border-gray-100">
               修改年份后，生肖-号码映射会自动切换到该年份的默认设置。如果需要手动调整，请前往"生肖映射"页签。
             </p>
          </div>
        )}

        {(activeTab === 'model' || activeTab === 'feature' || activeTab === 'training') && (
          <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-100 text-center">
            <Brain className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-800">该模块正在接入后端 AI 引擎</h3>
            <p className="text-sm text-gray-400 mt-2">单人开发版本中，目前使用默认训练参数。敬请期待后续更新。</p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
        <h4 className="text-sm font-semibold text-indigo-800 flex items-center gap-2 mb-2">
          <Info className="w-4 h-4" /> 开发者说明
        </h4>
        <ul className="text-[11px] text-indigo-700 space-y-1 list-disc list-inside">
          <li>所有配置均持久化：系统设置保存在后端 JSON，映射表保存在浏览器 LocalStorage。</li>
          <li>爬虫功能已通过后端代理绕过 CORS 限制，可直接抓取官方源。</li>
        </ul>
      </div>
    </div>
  );
}
