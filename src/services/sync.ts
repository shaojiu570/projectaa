import { DrawRecord } from '../data/types';
import { LotteryRecord } from './crawler';

const CRAWL_URLS = [
  { name: '123720彩票网', url: 'https://kj.123720c.com/kj/' },
  { name: '澳门六合彩', url: 'https://38.11.29.1:50001/historys/mo/' },
  { name: '1688188彩票', url: 'https://www.1688188.com/' },
];

async function fetchYearHtml(year: number): Promise<{ html: string; source: string } | null> {
  for (const source of CRAWL_URLS) {
    const urlsToTry = [
      `${source.url}${year}/`,
      `${source.url}?year=${year}`,
      `${source.url}index_${year}.html`,
      `${source.url}history/${year}.html`,
      `${source.url}${year}.html`,
      source.url,
    ];
    for (const url of urlsToTry) {
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(10000),
        });
        if (response.ok) {
          const html = await response.text();
          if (html && html.length > 1000) return { html, source: source.name };
        }
      } catch { /* skip */ }
    }
  }
  return null;
}

function parseHtmlToRecords(html: string, targetYear: number): DrawRecord[] {
  const records: DrawRecord[] = [];
  const cleanHtml = html.replace(/\r\n/g, '').replace(/\n/g, '');
  const blockRegex = /<div class="kj-tit">[\s\S]*?<\/div>[\s\S]*?<div class="kj-box">[\s\S]*?<\/div>/g;
  const blocks = cleanHtml.match(blockRegex) || [];
  for (const block of blocks) {
    const dateMatch = block.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    const issueMatch = block.match(/第[\s\S]*?<[^>]+>(\d+)<\/[^>]+>[\s\S]*?期/);
    if (!dateMatch || !issueMatch) continue;
    const year = parseInt(dateMatch[1]);
    if (year !== targetYear) continue;
    const month = parseInt(dateMatch[2]);
    const day = parseInt(dateMatch[3]);
    const issueNum = issueMatch[1].padStart(3, '0');
    const ballRegex = /<dt[^>]*class="ball-[^"]*"[^>]*>(\d+)<\/dt>/g;
    const numbers: number[] = [];
    let ballMatch;
    while ((ballMatch = ballRegex.exec(block)) !== null) {
      numbers.push(parseInt(ballMatch[1]));
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
  return records.sort((a, b) => a.date.localeCompare(b.date));
}

export async function syncFromBackend(): Promise<DrawRecord[]> {
  try {
    const response = await fetch('http://localhost:3001/api/data/export?format=json');
    const result = await response.json();
    if (result.success && Array.isArray(result.data)) {
      const backendData: LotteryRecord[] = result.data;
      const convertedData: DrawRecord[] = backendData.map(record => {
        let issue = record.Issue || `${record.Year}${String(record.Date).slice(5, 7).replace('-', '')}${String(record.Date).slice(8, 10)}`;
        return {
          issue, date: record.Date,
          normals: [record.Num1, record.Num2, record.Num3, record.Num4, record.Num5, record.Num6],
          special: record.Special,
        };
      });
      if (convertedData.length > 0) return convertedData;
    }
  } catch {
    console.warn('后端不可用，尝试网页爬取...');
  }

  try {
    const today = new Date();
    const startYear = 2023;
    const allRecords: DrawRecord[] = [];

    for (let y = startYear; y <= today.getFullYear(); y++) {
      const result = await fetchYearHtml(y);
      if (result) {
        const records = parseHtmlToRecords(result.html, y);
        allRecords.push(...records);
        console.log(`爬取 ${y} 年 ${records.length} 期`);
      }
    }

    return allRecords;
  } catch (e) {
    console.error('网页爬取失败:', e);
  }

  return [];
}
