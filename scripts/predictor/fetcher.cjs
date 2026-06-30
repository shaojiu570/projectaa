/**
 * 六合彩预测系统 - 数据获取 v2
 * 多数据源 + 灵活解析 + 容灾
 */

const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '../../data/lottery-data.json');
const REFRESH = process.argv.includes('--refresh');

// ====================== 数据源配置 ======================

const DATA_SOURCES = [
  {
    name: '澳门六合彩',
    defaultUrl: 'https://38.11.29.1:50001/historys/mo/',
    buildYearUrls: (year) => [
      `${year}.html`,
    ],
    defaultYearStart: 2021,
  },
  {
    name: '123720彩票网',
    defaultUrl: 'https://kj.123720c.com/kj/',
    buildYearUrls: (year) => [
      `${year}/`,
      `?year=${year}`,
      `index_${year}.html`,
      `history/${year}.html`,
      `${year}.html`,
    ],
    defaultYearStart: 2020,
  },
];

// 环境变量 DATA_SOURCE 可覆盖或添加自定义源
const ENV_SOURCE_URL = process.env.DATA_SOURCE;
if (ENV_SOURCE_URL && !DATA_SOURCES.find(s => s.defaultUrl === ENV_SOURCE_URL)) {
  DATA_SOURCES.push({
    name: '自定义源',
    defaultUrl: ENV_SOURCE_URL,
    buildYearUrls: (year) => [
      `${year}/`,
      `?year=${year}`,
      `index_${year}.html`,
      `history/${year}.html`,
      `${year}.html`,
    ],
    defaultYearStart: 2020,
  });
}

// ====================== 解析引擎 ======================

/**
 * 方案1：块结构解析（kj-tit + kj-box）
 * 支持 <span> / <font> / 任意标签包裹期号
 */
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

/**
 * 方案2：表格结构解析（<table> 含 tr/td + 年月日 + ball 类名）
 */
function parseTableStructure(html) {
  const records = [];
  const cleanHtml = html.replace(/\r\n/g, '').replace(/\n/g, '');

  // 查找包含开奖号码的表格行
  const rowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?(\d{4})[年-](\d{1,2})[月-](\d{1,2})[\s\S]*?<\/td>[\s\S]*?<td[^>]*>[\s\S]*?第(\d+)期[\s\S]*?<\/td>[\s\S]*?<td[^>]*>[\s\S]*?(?:\d+[\s\S]*?){7,}[\s\S]*?<\/td>[\s\S]*?<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(cleanHtml)) !== null) {
    const year = parseInt(rowMatch[1]);
    const month = parseInt(rowMatch[2]);
    const day = parseInt(rowMatch[3]);
    const issueNum = rowMatch[4].padStart(3, '0');

    const numbers = [];
    const numRegex = /(\d{1,2})/g;
    // 从行内提取7个号码
    const cellText = rowMatch[0];
    const allNums = [];
    let nm;
    while ((nm = numRegex.exec(cellText)) !== null) {
      const n = parseInt(nm[1]);
      if (n >= 1 && n <= 49) allNums.push(n);
    }
    // 尝试从 ball class 提取
    const ballRegex = /class="[^"]*ball[^"]*"[^>]*>\s*(\d+)\s*</g;
    let bm;
    while ((bm = ballRegex.exec(rowMatch[0])) !== null) {
      const n = parseInt(bm[1]);
      if (n >= 1 && n <= 49) numbers.push(n);
    }
    // 回退到所有数字取最后7个
    if (numbers.length < 7) {
      const candidates = allNums.filter(n => !numbers.includes(n));
      numbers.push(...candidates.slice(0, 7 - numbers.length));
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

/**
 * 方案3：平铺扫描（所有数字+日期的全局匹配，不依赖特定结构）
 */
function parseFlatScan(html) {
  const records = [];
  const ballRegex = /class="[^"]*ball[^"]*"[^>]*>\s*(\d+)\s*</g;
  const allNumbers = [];
  let m;
  while ((m = ballRegex.exec(html)) !== null) {
    const n = parseInt(m[1]);
    if (n >= 1 && n <= 49) allNumbers.push(n);
  }

  const dateIssueRegex = /(\d{4})[年-](\d{1,2})[月-](\d{1,2})[^\d]*?第(\d+)[期期]/g;
  const meta = [];
  while ((m = dateIssueRegex.exec(html)) !== null) {
    meta.push({
      date: `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`,
      issue: m[1] + m[4].padStart(3, '0'),
    });
  }

  if (allNumbers.length >= 7) {
    const draws = Math.floor(allNumbers.length / 7);
    for (let i = 0; i < draws; i++) {
      const nums = allNumbers.slice(i * 7, (i + 1) * 7);
      const special = nums.pop();
      const mi = meta[meta.length - 1 - i] || { date: '', issue: `HK${String(draws - i).padStart(4, '0')}` };
      records.push({ issue: mi.issue, date: mi.date, normals: [...nums], special });
    }
    records.reverse();
  }
  return records;
}

/**
 * 尝试所有解析方案
 */
function extractRecords(html) {
  // 方案1：块结构（最精确）
  let records = parseBlockStructure(html);
  if (records.length > 0) {
    console.log(`   块结构解析 → ${records.length} 条`);
    return records;
  }

  // 方案2：表格结构
  records = parseTableStructure(html);
  if (records.length > 0) {
    console.log(`   表格结构解析 → ${records.length} 条`);
    return records;
  }

  // 方案3：平铺扫描（兜底）
  records = parseFlatScan(html);
  if (records.length > 0) {
    console.log(`   平铺扫描解析 → ${records.length} 条`);
    return records;
  }

  console.log('   ⚠️ 无法解析数据');
  return [];
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

// ====================== 网络请求 ======================

async function fetchUrl(url, baseUrl) {
  const fullUrl = url.startsWith('http') ? url : baseUrl + url;
  try {
    const resp = await fetch(fullUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    if (html.length > 1000) return html;
  } catch (e) {}
  return null;
}

// ====================== 主流程 ======================

async function fetchData() {
  if (!REFRESH) {
    const cached = loadFromCache();
    if (cached && cached.length >= 100) return cached;
  }

  const currentYear = new Date().getFullYear();
  const allRecords = [];
  const usedSources = [];

  for (const source of DATA_SOURCES) {
    console.log(`\n🌐 尝试数据源: ${source.name} (${source.defaultUrl})`);

    // 默认页面
    const defaultHtml = await fetchUrl(source.defaultUrl, '');
    if (defaultHtml) {
      const records = extractRecords(defaultHtml);
      for (const r of records) {
        if (!allRecords.find(x => x.issue === r.issue)) allRecords.push(r);
      }
    }

    // 逐年份
    const startYear = source.defaultYearStart || 2020;
    for (let year = currentYear; year >= startYear; year--) {
      const urls = source.buildYearUrls(year);
      let found = false;
      for (const url of urls) {
        const html = await fetchUrl(url, source.defaultUrl);
        if (!html) continue;
        const records = extractRecords(html);
        if (records.length > 0) {
          let added = 0;
          for (const r of records) {
            if (!allRecords.find(x => x.issue === r.issue)) {
              allRecords.push(r);
              added++;
            }
          }
          console.log(`   ${year}年 → ${records.length} 条${added > 0 ? `，新增${added}` : '（全部重复）'}`);
          found = true;
          break;
        }
      }
      if (!found) console.log(`   ${year}年 → 无数据`);
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