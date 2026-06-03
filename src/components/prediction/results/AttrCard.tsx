interface AttrCardProps {
  title: string;
  items: { name: string; count: number }[];
  colors: Record<string, string>;
}

export default function AttrCard({ title, items, colors }: AttrCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <h4 className="font-medium text-gray-700 mb-3">{title}</h4>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.name} className="flex items-center justify-between">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[item.name] || 'bg-gray-100 text-gray-700'}`}>
              {item.name}
            </span>
            <span className="text-sm text-gray-600">{item.count}个</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function summarize(vals: string[]) {
  const c: Record<string, number> = {};
  vals.forEach(v => (c[v] = (c[v] || 0) + 1));
  return Object.entries(c)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}
