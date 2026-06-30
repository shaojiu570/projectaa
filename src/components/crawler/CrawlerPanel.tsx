import { useState, useEffect } from 'react';
import { useData } from '../../stores/DataContext';
import { Globe, Download, RefreshCw, Plus, Trash2, X, Link } from 'lucide-react';

interface CrawlerUrl {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

interface CrawlerPanelProps {
  onFlash: (msg: string) => void;
}

const DEFAULT_URLS: CrawlerUrl[] = [
  { id: '1', name: '123720彩票网', url: 'https://kj.123720c.com/kj/', enabled: true },
  { id: '2', name: '澳门六合彩', url: 'https://38.11.29.1:50001/historys/mo/', enabled: true },
  { id: '3', name: '1688188彩票', url: 'https://www.1688188.com/', enabled: true },
];

const CRAWLER_URLS_KEY = 'lottery_crawler_urls';

export default function CrawlerPanel({ onFlash }: CrawlerPanelProps) {
  const { data, setData, syncFromBackend } = useData();
  const [crawling, setCrawling] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, year: 0 });
  const [urls, setUrls] = useState<CrawlerUrl[]>(() => {
    const saved = localStorage.getItem(CRAWLER_URLS_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_URLS;
  });
  const [selectedUrlId, setSelectedUrlId] = useState<string>(() => {
    const saved = localStorage.getItem(CRAWLER_URLS_KEY);
    const savedUrls = saved ? JSON.parse(saved) : DEFAULT_URLS;
    return savedUrls[0]?.id || '1';
  });
  const [year, setYear] = useState(new Date().getFullYear());
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const [showUrlEditor, setShowUrlEditor] = useState(false);
  const [newUrlName, setNewUrlName] = useState('');
  const [newUrl, setNewUrl] = useState('');

  useEffect(() => {
    localStorage.setItem(CRAWLER_URLS_KEY, JSON.stringify(urls));
  }, [urls]);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const checkStatus = async () => {
      if (!activeTaskId) return;

      try {
        const response = await fetch(`http://localhost:3001/api/crawler/status/${activeTaskId}`);
        const result = await response.json();
        if (result.success && result.data) {
          const task = result.data;
          setProgress(task.progress);

          if (task.status === 'completed') {
            setActiveTaskId(null);
            setCrawling(false);
            onFlash('数据爬取完成！正在同步到本地...');
            syncFromBackend();
          } else if (task.status === 'failed') {
            setActiveTaskId(null);
            setCrawling(false);
            onFlash(`爬取失败: ${task.error}`);
          } else {
            timer = setTimeout(checkStatus, 2000);
          }
        }
      } catch (error) {
        console.error('查询状态失败:', error);
      }
    };

    if (activeTaskId) {
      checkStatus();
    }

    return () => clearTimeout(timer);
  }, [activeTaskId]);

  const startCrawl = async () => {
    const selectedUrl = urls.find(u => u.id === selectedUrlId);
    if (!selectedUrl) {
      onFlash('请选择要爬取的数据源');
      return;
    }

    setCrawling(true);
    const existingData = data || [];
    const existingCount = existingData.length;

    let startYear = 2020;
    if (existingCount > 0) {
      const dates = existingData.map((r: any) => new Date(r.date)).filter((d: Date) => !isNaN(d.getTime()));
      if (dates.length > 0) {
        const latestDate = new Date(Math.max(...dates.map((d: Date) => d.getTime())));
        startYear = latestDate.getFullYear();
        onFlash(`已有 ${existingCount} 期数据，仅补充 ${startYear} 年后新记录`);
      }
    } else {
      onFlash('无本地数据，将从 2020 年开始全量爬取');
    }

    const currentYear = new Date().getFullYear();
    const totalYears = currentYear - startYear + 1;
    let allRecords: any[] = [];

    for (let y = startYear; y <= currentYear; y++) {
      setProgress({ current: y - startYear, total: totalYears, year: y });
      onFlash(`正在爬取 ${y} 年数据...`);

      const urlsToTry = [
        selectedUrl.url + y + '/',
        selectedUrl.url + '?year=' + y,
        selectedUrl.url + 'index_' + y + '.html',
        selectedUrl.url + 'history/' + y + '.html',
        selectedUrl.url + y + '.html',
        selectedUrl.url
      ];

      let html = null;
      for (const url of urlsToTry) {
        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });
          if (response.ok) {
            html = await response.text();
            if (html && html.length > 1000) break;
          }
        } catch (e) { /* skip */ }
      }

      if (html) {
        const records = parseHtmlToRecords(html, y);
        allRecords = [...allRecords, ...records];
        onFlash(`成功获取 ${y} 年 ${records.length} 期`);
      }
      await new Promise(r => setTimeout(r, 500));
    }

    setProgress({ current: totalYears, total: totalYears, year: currentYear });

    const existingIssues = new Set(existingData.map((r: any) => r.issue));
    const newRecords = allRecords.filter((r: any) => !existingIssues.has(r.issue));
    const mergedData = [...existingData, ...newRecords];
    mergedData.sort((a: any, b: any) => a.date.localeCompare(b.date));
    setData(mergedData);
    onFlash(newRecords.length > 0
      ? `成功新增 ${newRecords.length} 期数据，总计 ${mergedData.length} 期！`
      : '已是最新数据，无需更新');
    setCrawling(false);
  };

  function parseHtmlToRecords(html: string, targetYear: number) {
    const records: any[] = [];

    const cleanHtml = html.replace(/\r\n/g, '').replace(/\n/g, '');

    const blockRegex = /<div class="kj-tit">[\s\S]*?<\/div>[\s\S]*?<div class="kj-box">[\s\S]*?<\/div>/g;
    const blocks = cleanHtml.match(blockRegex) || [];

    console.log(`找到 ${blocks.length} 个开奖块`);

    for (const block of blocks) {
      const dateMatch = block.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      const issueMatch = block.match(/第[\s\S]*?<[^>]+>(\d+)<\/[^>]+>[\s\S]*?期/);

      if (dateMatch && issueMatch) {
        const year = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]);
        const day = parseInt(dateMatch[3]);
        const issueNum = issueMatch[1].padStart(3, '0');

        const ballRegex = /<dt[^>]*class="ball-[^"]*"[^>]*>(\d+)<\/dt>/g;
        const numbers: number[] = [];
        let ballMatch;
        while ((ballMatch = ballRegex.exec(block)) !== null) {
          numbers.push(parseInt(ballMatch[1]));
        }

        if (numbers.length >= 7) {
          records.push({
            issue: `${year}${issueNum}`,
            date: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
            normals: numbers.slice(0, 6),
            special: numbers[6]
          });
        }
      }
    }

    console.log(`解析得到 ${records.length} 条记录`);

    records.sort((a: any, b: any) => a.date.localeCompare(b.date));

    return records;
  }

  function generateDate(year: number, index: number, total: number) {
    const monthLengths = [31,28,31,30,31,30,31,31,30,31,30,31];
    let remaining = index;

    for (let m = 1; m <= 12; m++) {
      const days = monthLengths[m-1];
      if (remaining < days) {
        return `${year}-${String(m).padStart(2,'0')}-${String(remaining+1).padStart(2,'0')}`;
      }
      remaining -= days;
    }

    return `${year}-12-31`;
  }

  const handleAddUrl = () => {
    if (!newUrlName.trim() || !newUrl.trim()) {
      onFlash('请填写名称和网址');
      return;
    }
    const newId = Date.now().toString();
    setUrls([...urls, { id: newId, name: newUrlName, url: newUrl, enabled: true }]);
    setNewUrlName('');
    setNewUrl('');
    setShowUrlEditor(false);
    onFlash('数据源添加成功');
  };

  const handleDeleteUrl = (id: string) => {
    setUrls(urls.filter(u => u.id !== id));
    if (selectedUrlId === id) {
      setSelectedUrlId(urls[0]?.id || '');
    }
    onFlash('数据源已删除');
  };

  const handleToggleUrl = (id: string) => {
    setUrls(urls.map(u => u.id === id ? { ...u, enabled: !u.enabled } : u));
  };

  const exportData = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/data/export');
      const data = await response.json();
      if (data.success) {
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lottery_data_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        onFlash('数据导出成功');
      } else {
        onFlash('导出失败');
      }
    } catch (error) {
      onFlash('导出失败');
    }
  };

  const importData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target?.result as string);
            const convertedData = data.map((record: any) => ({
              issue: `${record.Year}${String(record.Date).slice(5, 7).replace('-', '')}`,
              date: record.Date,
              normals: [record.Num1, record.Num2, record.Num3, record.Num4, record.Num5, record.Num6],
              special: record.Special,
            }));
            setData(convertedData);
            onFlash(`成功导入 ${convertedData.length} 期记录`);
          } catch (error) {
            onFlash('导入失败，文件格式错误');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">🌐 开奖数据爬取</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUrlEditor(true)}
              className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <Link className="w-4 h-4" />
              管理数据源
            </button>
            <Globe className="w-5 h-5 text-indigo-600" />
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-yellow-800">
            <b>⚠️ 注意事项：</b>前端爬取功能可能受CORS限制。建议配合代理服务器或后端API使用。
          </p>
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 block mb-1">选择数据源</label>
          <select
            value={selectedUrlId}
            onChange={(e) => setSelectedUrlId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {urls.filter(u => u.enabled).map(url => (
              <option key={url.id} value={url.id}>{url.name}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            当前: {urls.find(u => u.id === selectedUrlId)?.url || '未选择'} · 将爬取 {new Date().getFullYear()} 年最新数据
          </p>
        </div>

        <button
          onClick={startCrawl}
          disabled={crawling}
          className="w-full py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
        >
          {crawling ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              爬取中... {progress.year}年 ({progress.current + 1}/{progress.total})
            </>
          ) : (
            <>
              <Globe className="w-4 h-4" />
              开始爬取数据
            </>
          )}
        </button>

        {crawling && (
          <div className="mt-4">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1 text-center">正在爬取 {progress.year} 年最新开奖数据...</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 数据导入/导出</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={exportData}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
          >
            <div className="flex items-center gap-2 mb-1">
              <Download className="w-4 h-4" />
              <div className="font-medium text-gray-800">导出JSON</div>
            </div>
            <div className="text-sm text-gray-500">将爬取的数据导出为JSON文件</div>
          </button>
          <button
            onClick={importData}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
          >
            <div className="flex items-center gap-2 mb-1">
              <RefreshCw className="w-4 h-4" />
              <div className="font-medium text-gray-800">导入JSON</div>
            </div>
            <div className="text-sm text-gray-500">从JSON文件导入开奖记录</div>
          </button>
        </div>
      </div>

      {showUrlEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">🔗 管理数据源</h3>
              <button onClick={() => setShowUrlEditor(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              {urls.map(url => (
                <div key={url.id} className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg">
                  <input
                    type="checkbox"
                    checked={url.enabled}
                    onChange={() => handleToggleUrl(url.id)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800">{url.name}</div>
                    <div className="text-xs text-gray-500 truncate">{url.url}</div>
                  </div>
                  <button
                    onClick={() => handleDeleteUrl(url.id)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">添加新数据源</h4>
              <div className="space-y-2">
                <input
                  type="text"
                  value={newUrlName}
                  onChange={(e) => setNewUrlName(e.target.value)}
                  placeholder="数据源名称（如：我的彩票网）"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <input
                  type="text"
                  value={newUrl}
                  onChange={(e) =>setNewUrl(e.target.value)}
                  placeholder="网址（如：https://example.com/kj）"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <button
                  onClick={handleAddUrl}
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  添加数据源
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
