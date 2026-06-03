import { Search } from 'lucide-react';

interface FilterPanelProps {
  search: string;
  setSearch: (v: string) => void;
  filterZodiac: string;
  setFilterZodiac: (v: string) => void;
  filterColor: string;
  setFilterColor: (v: string) => void;
  setPage: (v: number) => void;
  totalCount: number;
}

const ZODIACS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

export default function FilterPanel({
  search, setSearch, filterZodiac, setFilterZodiac, filterColor, setFilterColor, setPage, totalCount,
}: FilterPanelProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索期数、日期或特码..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filterZodiac}
          onChange={e => { setFilterZodiac(e.target.value); setPage(0); }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="">全部生肖</option>
          {ZODIACS.map(z => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
        <select
          value={filterColor}
          onChange={e => { setFilterColor(e.target.value); setPage(0); }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="">全部波色</option>
          <option value="红波">红波</option>
          <option value="蓝波">蓝波</option>
          <option value="绿波">绿波</option>
        </select>
        <div className="flex items-center text-sm text-gray-500">
          共 <b className="mx-1 text-gray-800">{totalCount}</b> 条记录
        </div>
      </div>
    </div>
  );
}
