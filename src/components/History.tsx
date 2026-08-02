import { useState, useMemo } from 'react';
import { useData } from '../stores/DataContext';
import { useMapping } from '../stores/MappingContext';
import DataManager from './history/DataManager';
import FilterPanel from './history/FilterPanel';
import DataTable from './history/DataTable';
import CrawlerPanel from './crawler/CrawlerPanel';

const PAGE_SIZE = 20;

export default function History() {
  const { data, removeRecord, removeRecords } = useData();
  const { getZodiac, getColor, getElement, getZodiacByDateAndNumber } = useMapping();

  const [subTab, setSubTab] = useState<'data' | 'crawler'>('data');
  const [flashMsg, setFlashMsg] = useState('');

  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [filterZodiac, setFilterZodiac] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set());
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = [...data].reverse();
    if (search) {
      result = result.filter(d =>
        d.issue.includes(search) || d.date.includes(search) || d.special.toString() === search
      );
    }
    if (filterZodiac) result = result.filter(d => getZodiacByDateAndNumber(d.date, d.special) === filterZodiac);
    if (filterColor) result = result.filter(d => getColor(d.special) === filterColor);
    return result;
  }, [data, search, filterZodiac, filterColor, getZodiac, getColor, getZodiacByDateAndNumber]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // 批量删除处理
  const handleBatchDelete = () => {
    if (selectedIssues.size === 0) return;
    if (!confirm(`确认删除选中的 ${selectedIssues.size} 条记录？`)) return;
    removeRecords(Array.from(selectedIssues));
    setSelectedIssues(new Set());
    if (page >= totalPages - 1 && page > 0) {
      setPage(page - 1);
    }
  };

  const toggleSelect = (issue: string) => {
    const newSet = new Set(selectedIssues);
    if (newSet.has(issue)) {
      newSet.delete(issue);
    } else {
      newSet.add(issue);
    }
    setSelectedIssues(newSet);
  };

  const toggleSelectAll = () => {
    const pageIssues = pageData.map(d => d.issue);
    const allSelected = pageIssues.every(issue => selectedIssues.has(issue));
    const newSet = new Set(selectedIssues);
    if (allSelected) {
      pageIssues.forEach(issue => newSet.delete(issue));
    } else {
      pageIssues.forEach(issue => newSet.add(issue));
    }
    setSelectedIssues(newSet);
  };

  const onFlash = (msg: string) => {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(''), 3000);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setSubTab('data')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            subTab === 'data'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
          }`}
        >
          📊 数据查看
        </button>
        <button
          onClick={() => setSubTab('crawler')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            subTab === 'crawler'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
          }`}
        >
          🌐 数据爬取
        </button>
      </div>

      {flashMsg && (
        <div className="bg-green-100 text-green-700 p-3 rounded-lg text-sm flex items-center gap-2">
          {flashMsg}
        </div>
      )}

      {subTab === 'data' ? (
        <>
          <DataManager />

          <FilterPanel
            search={search}
            setSearch={setSearch}
            filterZodiac={filterZodiac}
            setFilterZodiac={setFilterZodiac}
            filterColor={filterColor}
            setFilterColor={setFilterColor}
            setPage={setPage}
            totalCount={data.length}
          />

          <DataTable
            pageData={pageData}
            page={page}
            setPage={setPage}
            totalPages={totalPages}
            totalFiltered={filtered.length}
            getZodiac={getZodiac}
            getColor={getColor}
            getElement={getElement}
            getZodiacByDateAndNumber={getZodiacByDateAndNumber}
            removeRecord={removeRecord}
            selectedIssues={selectedIssues}
            setSelectedIssues={setSelectedIssues}
            expandedIssue={expandedIssue}
            setExpandedIssue={setExpandedIssue}
            toggleSelect={toggleSelect}
            toggleSelectAll={toggleSelectAll}
            handleBatchDelete={handleBatchDelete}
          />
        </>
      ) : (
        <CrawlerPanel onFlash={onFlash} />
      )}
    </div>
  );
}
