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
 * 从多个URL尝试获取数据
 */
async function fetchPages(urls) {
  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) continue;
      const html = await resp.text();
      if (/六合彩/i.test(html) && /ball/i.test(html)) {
        console.log('✅ 成功获取:', url);
        return html;
      }
    } catch (e) {
      // 尝试下一个
    }
  }
  return null;
}

/**
 * 从HTML解析开奖记录
 */
function extractRecordsFromHTML(html) {
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
 * 获取开奖数据
 * 优先从缓存读取，缓存不存在或不满足100条时从网络爬取
 */
async function fetchData() {
  // --refresh 模式跳过缓存，强制从网络爬取
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

  // 尝试获取最多5年数据
  const yearUrls = [];
  for (let year = currentYear; year >= currentYear - 4; year--) {
    yearUrls.push(`${DATA_SOURCE}${year}/`);
  }
  yearUrls.push(DATA_SOURCE); // 默认页面

  for (const url of yearUrls) {
    const html = await fetchPages([url]);
    if (html) {
      const records = extractRecordsFromHTML(html);
      if (records.length > 0) {
        for (const r of records) {
          if (!allRecords.find(x => x.issue === r.issue)) {
            allRecords.push(r);
          }
        }
      }
    }
  }

  allRecords.sort((a, b) => a.issue.localeCompare(b.issue));

  console.log('解析到', allRecords.length, '条记录');

  if (allRecords.length >= 100) {
    saveToCache(allRecords);
  } else {
    console.error('数据不足（' + allRecords.length + '条），需要至少100期');
  }

  return allRecords;
}

module.exports = { fetchData };