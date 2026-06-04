/**
 * 六合彩预测系统 - 数据获取
 * 从网络爬取真实开奖数据，支持本地缓存避免重复请求
 */

const fs = require('fs');
const path = require('path');

const DATA_SOURCE = process.env.DATA_SOURCE || 'https://kj.123720c.com/kj/';
const CACHE_FILE = path.join(__dirname, '../../data/lottery-data.json');
const REFRESH = process.argv.includes('--refresh');

/**
 * 从单个URL获取数据
 */
async function fetchUrl(url) {
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    if (html.length > 1000) {
      return html;
    }
  } catch (e) {}
  return null;
}

/**
 * 从HTML解析开奖记录
 * 支持多种HTML格式
 */
function extractRecordsFromHTML(html) {
  // 方案1：匹配 class 包含 ball 的元素
  let ballRegex = /class="[^"]*ball[^"]*"[^>]*>\s*(\d+)\s*</gi;
  let allNumbers = [];
  let m;
  while ((m = ballRegex.exec(html)) !== null) {
    const n = parseInt(m[1]);
    if (n >= 1 && n <= 49 && !allNumbers.includes(n)) allNumbers.push(n);
  }

  // 方案2：如果方案1没拿到数据，尝试匹配数字球常见格式
  if (allNumbers.length < 7) {
    ballRegex = /<[^>]+>\s*(\d{1,2})\s*<\/[^>]+>/g;
    const candidates = [];
    while ((m = ballRegex.exec(html)) !== null) {
      const n = parseInt(m[1]);
      if (n >= 1 && n <= 49) candidates.push(n);
    }
    // 只取7的倍数个，按频率筛选
    if (candidates.length >= 7) {
      const freq = new Array(50).fill(0);
      candidates.forEach(n => freq[n]++);
      const sorted = candidates.sort((a, b) => freq[b] - freq[a]);
      allNumbers = [...new Set(sorted.slice(0, Math.floor(sorted.length / 7) * 7))];
    }
  }

  const dateIssueRegex = /(\d{4})[年-](\d{1,2})[月-](\d{1,2})[^\d]*?第(\d+)[期期]/g;
  const meta = [];
  while ((m = dateIssueRegex.exec(html)) !== null) {
    meta.push({
      date: `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`,
      issue: m[1] + m[4].padStart(3, '0')
    });
  }

  if (allNumbers.length < 7) return [];

  const perDraw = 7;
  const draws = Math.floor(allNumbers.length / perDraw);
  const records = [];

  for (let i = 0; i < draws; i++) {
    const nums = allNumbers.slice(i * perDraw, (i + 1) * perDraw);
    const special = nums.pop();
    const mi = meta[meta.length - 1 - i] || {
      date: '',
      issue: `HK${String(draws - i).padStart(4, '0')}`
    };
    records.push({
      issue: mi.issue,
      date: mi.date,
      normals: [...nums],
      special
    });
  }

  return records.reverse();
}

/**
 * 从本地缓存加载数据
 */
function loadFromCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      console.log('📂 从缓存加载数据:', data.length, '条');
      return data;
    }
  } catch (e) {
    console.log('⚠️ 缓存读取失败:', e.message);
  }
  return null;
}

/**
 * 保存数据到本地缓存
 */
function saveToCache(records) {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(records, null, 2), 'utf-8');
    console.log('💾 数据已缓存到:', CACHE_FILE);
  } catch (e) {
    console.log('⚠️ 缓存写入失败:', e.message);
  }
}

/**
 * 为某一年构建多个可能的URL（与本地爬虫一致）
 */
function buildYearUrls(year) {
  return [
    `${DATA_SOURCE}${year}/`,
    `${DATA_SOURCE}?year=${year}`,
    `${DATA_SOURCE}index_${year}.html`,
    `${DATA_SOURCE}history/${year}.html`,
    `${DATA_SOURCE}${year}.html`,
  ];
}

/**
 * 获取开奖数据
 * 优先从缓存读取，--refresh 时强制从网络爬取
 */
async function fetchData() {
  // --refresh 模式跳过缓存
  if (!REFRESH) {
    const cached = loadFromCache();
    if (cached && cached.length >= 100) {
      return cached;
    }
    if (cached) {
      console.log('⚠️ 缓存数据不足（' + cached.length + '条），重新爬取');
    }
  } else {
    console.log('🔄 --refresh 模式，强制从网络爬取');
  }

  const currentYear = new Date().getFullYear();
  const allRecords = [];

  // 先爬默认页面（通常包含当年全部数据）
  const defaultHtml = await fetchUrl(DATA_SOURCE);
  if (defaultHtml) {
    const records = extractRecordsFromHTML(defaultHtml);
    console.log(`✅ 默认页面 → ${records.length} 条`);
    for (const r of records) {
      if (!allRecords.find(x => x.issue === r.issue)) {
        allRecords.push(r);
      }
    }
  }

  // 逐年份爬取，每个年份尝试多种URL格式
  for (let year = currentYear; year >= 2020; year--) {
    const urls = buildYearUrls(year);
    let found = false;
    for (const url of urls) {
      const html = await fetchUrl(url);
      if (!html) continue;
      const records = extractRecordsFromHTML(html);
      if (records.length > 0) {
        let added = 0;
        for (const r of records) {
          if (!allRecords.find(x => x.issue === r.issue)) {
            allRecords.push(r);
            added++;
          }
        }
        console.log(`   ${year}年(${url.split('?')[0].slice(-20)}) → ${records.length} 条${added > 0 ? '，新增' + added : '（全部重复）'}`);
        found = true;
        break;
      }
    }
    if (!found) {
      console.log(`   ${year}年 → 未获取到数据`);
    }
  }

  allRecords.sort((a, b) => a.issue.localeCompare(b.issue));

  console.log('📊 共解析到', allRecords.length, '条记录');

  if (allRecords.length >= 100) {
    saveToCache(allRecords);
  } else {
    console.error('⚠️ 数据不足（' + allRecords.length + '条），需要至少100期');
  }

  return allRecords;
}

module.exports = { fetchData };