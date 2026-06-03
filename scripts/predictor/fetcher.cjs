/**
 * 六合彩预测系统 - 数据获取
 * 使用与本地前端一致的 seededRandom(42) 生成模拟数据
 * 数据量随当前日期自动增长，确保预测结果与本地一致
 */

function seededRandom(s) {
  let seed = s;
  return () => {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

/**
 * 生成模拟开奖数据（与 src/data/historicalData.ts 算法一致）
 */
function generateData() {
  const rng = seededRandom(42);
  const records = [];
  const startDate = new Date('2020-01-02');
  const currentDate = new Date();
  let counter = 1;

  while (true) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + counter - 1);
    if (date > currentDate) break;

    const all = [];
    while (all.length < 7) {
      const n = Math.floor(rng() * 49) + 1;
      if (!all.includes(n)) all.push(n);
    }
    const special = all.pop();
    records.push({
      issue: String(counter).padStart(3, '0'),
      date: date.toISOString().split('T')[0],
      normals: all,
      special,
    });
    counter++;
  }

  return records;
}

async function fetchData() {
  const data = generateData();
  console.log(`📊 数据生成成功: ${data.length} 期 (截至 ${data[data.length - 1].date})`);
  return data;
}

module.exports = { fetchData };