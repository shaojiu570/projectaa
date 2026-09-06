/**
 * 六合彩预测系统 - 数据获取
 * 多数据源 + JSON API + 容灾
 */

const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '../../data/lottery-data.json');
const REFRESH = process.argv.includes('--refresh');

// ====================== 数据源配置 ======================

const DATA_SOURCES = [
  {
    name: '开奖1868-香港六合彩',
    type: 'api',
    apiUrl: 'https://www.kj1868.cc/openapi/drawLottery/xg6/last.kj',
    defaultYearStart: 2021,
    pageSize: 100,
  },
  {
    name: '开奖1868-澳门六合彩',
    type: 'api',
    apiUrl: 'https://www.kj1868.cc/openapi/drawLottery/am6/last.kj',
    defaultYearStart: 2021,
    pageSize: 100,
  },
];

// ====================== API 解析 ======================

function parseApiData(json, year) {
  const records = [];
  if (json.status !== '10' || !json.data?.data) return records;

  for (const item of json.data.data) {
    const issue = item.period || '';
    const dateStr = item.lottery_date || '';
    const nums = (item.numbers || '').split(',').map(n => parseInt(n.trim())).filter(n => n >= 1 && n <= 49);

    if (issue && dateStr && nums.length >= 7) {
      records.push({
        issue: issue,
        date: dateStr,
        normals: nums.slice(0, 6),
        special: nums[6],
      });
    }
  }
  return records;
}

async function fetchFromApi(source, year) {
  const records = [];
  let page = 1;
  const maxPages = 20;

  while (page <= maxPages) {
    const url = `${source.apiUrl}?page=${page}&pageSize=${source.pageSize}`;
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) break;

      const json = await resp.json();
      if (json.status !== '10' || !json.data?.data?.length) break;

      const batch = parseApiData(json, year);
      const yearStr = String(year);
      const yearRecords = batch.filter(r => r.issue.startsWith(yearStr));

      if (yearRecords.length > 0) {
        records.push(...yearRecords);
        if (batch.length < source.pageSize) break;
        page++;
      } else {
        break;
      }
    } catch (e) {
      console.log(`   API 请求失败 (page ${page}): ${e.message}`);
      break;
    }
  }
  return records;
}

// ====================== HTML 解析（备用） ======================

function parseBlockStructure(html) {
  const records = [];
  const cleanHtml = html.replace(/\r\n/g, '').replace(/\n/g, '');
  const blocks = cleanHtml.match(/<div class="kj-tit">[\s\S]*?<\/div>[\s\S]*?<div class="kj-box">[\s\S]*?<\/div>/g) || [];

  for (const block of blocks) {
    const dateMatch = block.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    const issueMatch = block.match(/第[\s\S]*?<[^>]+>(\d+)<\/[^>]+>[\s\S]*?期/);
    if (!dateMatch || !issueMatch) continue;

    const year = parseInt(dateMatch[1]);
    const month = parseInt(dateMatch[2]);
    const day = parseInt(dateMatch[3]);
    const issueNum = issueMatch[1].padStart(3, '0');

    const ballRegex = /<dt[^>]*class="ball-[^"]*"[^>]*>(\d+)<\/dt>/g;
    const numbers = [];
    let m;
    while ((m = ballRegex.exec(block)) !== null) {
      numbers.push(parseInt(m[1]));
    }

    if (numbers.length >= 7) {
      records.push({
        issue: `${year}${issueNum}`,
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        normals: numbers.slice(0, 6),
        special: numbers[6],
      });
    }
  }
  return records;
}

// ====================== 缓存 ======================

function loadFromCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      console.log(`📂 从缓存加载数据: ${data.length} 条`);
      return data;
    }
  } catch (e) {
    console.log(`⚠️ 缓存读取失败: ${e.message}`);
  }
  return null;
}

function saveToCache(records) {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(records, null, 2), 'utf-8');
    console.log(`💾 数据已缓存到: ${CACHE_FILE}`);
  } catch (e) {
    console.log(`⚠️ 缓存写入失败: ${e.message}`);
  }
}

// ====================== 主流程 ======================

async function fetchData() {
  if (!REFRESH) {
    const cached = loadFromCache();
    if (cached && cached.length >= 100) return cached;
  }

  const currentYear = new Date().getFullYear();
  const allRecords = [];

  for (const source of DATA_SOURCES) {
    console.log(`\n🌐 尝试数据源: ${source.name}`);

    if (source.type === 'api') {
      for (let year = currentYear; year >= source.defaultYearStart; year--) {
        const records = await fetchFromApi(source, year);
        let added = 0;
        for (const r of records) {
          if (!allRecords.find(x => x.issue === r.issue)) {
            allRecords.push(r);
            added++;
          }
        }
        if (records.length > 0) {
          console.log(`   ${year}年 → ${records.length} 条${added > 0 ? `，新增${added}` : '（全部重复）'}`);
        } else {
          console.log(`   ${year}年 → 无数据`);
        }
      }
    }

    if (allRecords.length >= 100) {
      console.log(`\n✅ ${source.name} 累计获取 ${allRecords.length} 条，不再尝试后续数据源`);
      break;
    }
  }

  allRecords.sort((a, b) => a.issue.localeCompare(b.issue));
  console.log(`\n📊 共计 ${allRecords.length} 条记录`);

  if (allRecords.length >= 100) {
    saveToCache(allRecords);
  } else {
    console.error(`⚠️ 数据不足（${allRecords.length}条），需要至少100期`);
  }

  return allRecords;
}

module.exports = { fetchData };
