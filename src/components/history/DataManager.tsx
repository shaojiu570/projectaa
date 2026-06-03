import { useState } from 'react';
import { useData } from '../../stores/DataContext';
import { DrawRecord } from '../../data/types';
import { Plus, Upload, RotateCcw, X } from 'lucide-react';

export default function DataManager() {
  const { data, addRecord, resetData, clearAllData, syncFromBackend } = useData();

  const [showInput, setShowInput] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const [formIssue, setFormIssue] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formNormals, setFormNormals] = useState(['', '', '', '', '', '']);
  const [formSpecial, setFormSpecial] = useState('');
  const [formError, setFormError] = useState('');

  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState('');

  const handleAddRecord = () => {
    setFormError('');
    const issue = formIssue.trim();
    const date = formDate.trim();
    const normals = formNormals.map(n => parseInt(n.trim()));
    const special = parseInt(formSpecial.trim());

    if (!issue) { setFormError('请输入期数'); return; }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { setFormError('日期格式：YYYY-MM-DD'); return; }
    if (normals.some(n => isNaN(n) || n < 1 || n > 49)) { setFormError('平码范围1-49'); return; }
    if (new Set(normals).size !== 6) { setFormError('6个平码不能重复'); return; }
    if (isNaN(special) || special < 1 || special > 49) { setFormError('特码范围1-49'); return; }
    if (normals.includes(special)) { setFormError('特码不能与平码重复'); return; }
    if (data.some(d => d.issue === issue)) { setFormError('该期数已存在'); return; }

    const record: DrawRecord = {
      issue,
      date,
      normals: [...normals],
      special,
    };
    addRecord(record);
    setFormIssue('');
    setFormDate('');
    setFormNormals(['', '', '', '', '', '']);
    setFormSpecial('');
    setFormError('');
  };

  const handleImport = () => {
    setImportResult('');
    const lines = importText.trim().split('\n').filter(l => l.trim());
    let added = 0;
    let errors = 0;

    for (const line of lines) {
      const parts = line.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
      if (parts.length < 9) { errors++; continue; }
      const [issue, date, n1, n2, n3, n4, n5, n6, sp] = parts;
      const normals = [n1, n2, n3, n4, n5, n6].map(Number);
      const special = Number(sp);
      if (!issue || !date || normals.some(n => isNaN(n) || n < 1 || n > 49) || isNaN(special) || special < 1 || special > 49) {
        errors++;
        continue;
      }
      if (data.some(d => d.issue === issue)) { errors++; continue; }
      addRecord({ issue, date, normals: [...normals], special });
      added++;
    }
    setImportResult(`成功导入 ${added} 条，跳过 ${errors} 条`);
    if (added > 0) setImportText('');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-base font-semibold text-gray-800">📥 数据管理</h3>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowInput(!showInput); setShowImport(false); }}
            className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 transition-all ${
              showInput ? 'bg-indigo-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> 添加单条
          </button>
          <button
            onClick={() => { setShowImport(!showImport); setShowInput(false); }}
            className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 transition-all ${
              showImport ? 'bg-indigo-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Upload className="w-3.5 h-3.5" /> 批量导入
          </button>
          <button
            onClick={() => { if (confirm('确认重置为默认模拟数据？')) resetData(); }}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> 重置模拟数据
          </button>
          <button
            onClick={async () => { 
              if (confirm('确认清空所有本地数据并从服务器重新同步？')) {
                clearAllData();
                await syncFromBackend();
              }
            }}
            className="px-3 py-1.5 text-sm border border-red-200 rounded-lg text-red-600 hover:bg-red-50 flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" /> 清空并重新同步
          </button>
        </div>
      </div>

      {showInput && (
        <div className="p-5 border-b border-gray-100 bg-indigo-50/30">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-10 gap-3 items-end">
            <div className="col-span-1">
              <label className="text-xs text-gray-500 block mb-1">期数</label>
              <input
                type="text" value={formIssue} onChange={e => setFormIssue(e.target.value)}
                placeholder="2024001"
                className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="col-span-1">
              <label className="text-xs text-gray-500 block mb-1">日期</label>
              <input
                type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {formNormals.map((n, i) => (
              <div key={i}>
                <label className="text-xs text-gray-500 block mb-1">平码{i + 1}</label>
                <input
                  type="number" min={1} max={49} value={n}
                  onChange={e => {
                    const arr = [...formNormals];
                    arr[i] = e.target.value;
                    setFormNormals(arr);
                  }}
                  className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            ))}
            <div>
              <label className="text-xs text-gray-500 block mb-1">特码</label>
              <input
                type="number" min={1} max={49} value={formSpecial}
                onChange={e => setFormSpecial(e.target.value)}
                className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-yellow-50"
              />
            </div>
            <div>
              <button
                onClick={handleAddRecord}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
              >
                添加
              </button>
            </div>
          </div>
          {formError && (
            <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
              <X className="w-4 h-4" /> {formError}
            </p>
          )}
        </div>
      )}

      {showImport && (
        <div className="p-5 border-b border-gray-100 bg-indigo-50/30">
          <p className="text-xs text-gray-500 mb-2">
            CSV格式：每行一条记录，字段用逗号或空格分隔：<code className="bg-gray-200 px-1 rounded">期数,日期,平码1,平码2,平码3,平码4,平码5,平码6,特码</code>
          </p>
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            rows={5}
            placeholder="2024001,2024-01-02,5,12,18,23,27,33,48&#10;2024002,2024-01-04,3,8,15,22,35,41,7"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
          />
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={handleImport}
              disabled={!importText.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              导入数据
            </button>
            {importResult && (
              <span className="text-sm text-green-600">{importResult}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
