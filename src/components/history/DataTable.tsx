import { useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2, Trash, ChevronDown, ChevronUp } from 'lucide-react';
import NumberBall from '../NumberBall';
import { DrawRecord } from '../../data/types';

interface DataTableProps {
  pageData: DrawRecord[];
  page: number;
  setPage: (v: number) => void;
  totalPages: number;
  totalFiltered: number;
  getZodiac: (n: number) => string;
  getColor: (n: number) => string;
  getElement: (n: number, year?: number) => string;
  getZodiacByDateAndNumber: (date: string | Date, number: number) => string;
  removeRecord: (issue: string) => void;
  selectedIssues: Set<string>;
  setSelectedIssues: (issues: Set<string>) => void;
  expandedIssue: string | null;
  setExpandedIssue: (issue: string | null) => void;
  toggleSelect: (issue: string) => void;
  toggleSelectAll: () => void;
  handleBatchDelete: () => void;
}

const getParity = (n: number) => (n % 2 === 1 ? '奇' : '偶');
const getSize = (n: number) => (n >= 25 ? '大' : '小');

export default function DataTable({
  pageData, page, setPage, totalPages, totalFiltered, getZodiac, getColor, getElement, getZodiacByDateAndNumber, removeRecord,
  selectedIssues, toggleSelect, toggleSelectAll, handleBatchDelete,
}: DataTableProps) {
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

  const toggleExpand = (issue: string) => {
    setExpandedIssue(expandedIssue === issue ? null : issue);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="hidden md:flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={pageData.length > 0 && pageData.every(d => selectedIssues.has(d.issue))}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-600">全选本页</span>
          {selectedIssues.size > 0 && (
            <button
              onClick={handleBatchDelete}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors ml-2"
            >
              <Trash className="w-4 h-4" />
              删除选中 ({selectedIssues.size})
            </button>
          )}
        </div>
        <span className="text-sm text-gray-500">共 {totalFiltered} 条</span>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-2 py-3 text-center w-10"></th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">期数</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">日期</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">平码</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">特码</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">生肖</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">详情</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageData.map(d => {
              const zodiac = getZodiacByDateAndNumber(d.date, d.special);
              const color = getColor(d.special);
              const element = getElement(d.special, new Date(d.date).getFullYear());
              const isExpanded = expandedIssue === d.issue;
              return (
                <>
                  <tr key={d.issue} className="hover:bg-gray-50 transition-colors">
                    <td className="px-2 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIssues.has(d.issue)}
                        onChange={() => toggleSelect(d.issue)}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-3 text-sm font-mono text-gray-800">第{d.issue.slice(-3)}期</td>
                    <td className="px-3 py-3 text-sm text-gray-600">{d.date}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {d.normals.map((n, i) => <NumberBall key={i} number={n} size="sm" />)}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <NumberBall number={d.special} size="md" highlight />
                    </td>
                    <td className="px-3 py-3 text-center text-sm">{zodiac}</td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => toggleExpand(d.issue)}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => { if (confirm(`确认删除第${d.issue.slice(-3)}期？`)) removeRecord(d.issue); }}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-gray-50">
                      <td colSpan={8} className="px-3 py-3">
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-500">波色:</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            color === '红波' ? 'bg-red-100 text-red-700' : color === '蓝波' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {color}
                          </span>
                          <span className="text-gray-500 ml-2">五行:</span>
                          <span className="text-gray-700">{element}</span>
                          <span className="text-gray-500 ml-2">奇偶:</span>
                          <span className="text-gray-700">{getParity(d.special)}</span>
                          <span className="text-gray-500 ml-2">大小:</span>
                          <span className="text-gray-700">{getSize(d.special)}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {pageData.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">暂无数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden px-4 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={pageData.length > 0 && pageData.every(d => selectedIssues.has(d.issue))}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-600">全选本页</span>
        </div>
        {selectedIssues.size > 0 && (
          <button
            onClick={handleBatchDelete}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
          >
            <Trash className="w-4 h-4" />
            删除 ({selectedIssues.size})
          </button>
        )}
      </div>

      <div className="md:hidden">
        <div className="divide-y divide-gray-100">
          {pageData.map(d => {
            const zodiac = getZodiac(d.special);
            const color = getColor(d.special);
            const element = getElement(d.special, new Date(d.date).getFullYear());
            const isExpanded = expandedIssue === d.issue;
            return (
              <div key={d.issue} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIssues.has(d.issue)}
                    onChange={() => toggleSelect(d.issue)}
                    className="w-4 h-4 mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-mono text-gray-800">{d.issue}</span>
                      <span className="text-xs text-gray-500">{d.date}</span>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm text-gray-600">平码:</span>
                      <div className="flex gap-1 flex-wrap">
                        {d.normals.map((n, i) => <NumberBall key={i} number={n} size="sm" />)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">特码:</span>
                      <NumberBall number={d.special} size="sm" highlight />
                      <span className="text-sm text-gray-700 ml-1">{zodiac}</span>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">波色:</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            color === '红波' ? 'bg-red-100 text-red-700' : color === '蓝波' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {color}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">五行:</span>
                          <span className="text-gray-700">{element}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">奇偶:</span>
                          <span className="text-gray-700">{getParity(d.special)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">大小:</span>
                          <span className="text-gray-700">{getSize(d.special)}</span>
                        </div>
                      </div>
                    )}

                    <div className="mt-2 flex items-center justify-between">
                      <button
                        onClick={() => toggleExpand(d.issue)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                      >
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {isExpanded ? '收起' : '详情'}
                      </button>
                      <button
                        onClick={() => { if (confirm(`确认删除第${d.issue}期？`)) removeRecord(d.issue); }}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {pageData.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-400">暂无数据</div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
        <span className="text-sm text-gray-500">
          第 {page + 1}/{totalPages} 页
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="p-1.5 rounded border border-gray-200 disabled:opacity-50 hover:bg-gray-100"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="p-1.5 rounded border border-gray-200 disabled:opacity-50 hover:bg-gray-100"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
