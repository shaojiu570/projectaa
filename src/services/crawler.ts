import { getZodiacByNumber } from '../utils/lunarCalendar';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
];

interface RetryConfig {
  total: number;
  read: number;
  connect: number;
  backoffFactor: number;
  statusForcelist: number[];
}

export interface LotteryRecord {
  Date: string;
  Year: number;
  Issue: string;
  Num1: number;
  Num2: number;
  Num3: number;
  Num4: number;
  Num5: number;
  Num6: number;
  Special: number;
  Special_Zodiac: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getRandomUserAgent = () => {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
};

async function fetchWithRetry(url: string, maxRetries = 3, backoffFactor = 0.5): Promise<Response | null> {
  const retryConfig: RetryConfig = {
    total: maxRetries,
    read: maxRetries,
    connect: maxRetries,
    backoffFactor,
    statusForcelist: [500, 502, 503, 504],
  };

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
        },
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        return response;
      } else if (retryConfig.statusForcelist.includes(response.status)) {
        const waitTime = backoffFactor * Math.pow(2, attempt) * 1000;
        await sleep(waitTime);
        continue;
      } else {
        return null;
      }
    } catch (error) {
      if (attempt === maxRetries - 1) {
        return null;
      }
      const waitTime = backoffFactor * Math.pow(2, attempt) * 1000;
      await sleep(waitTime);
    }
  }

  return null;
}

export async function fetchYearData(year: number): Promise<string | null> {
  const baseUrl = 'https://kj.123720c.com/kj/';
  const urlsToTry = [
    `${baseUrl}${year}/`,
    `${baseUrl}?year=${year}`,
    `${baseUrl}index_${year}.html`,
    `${baseUrl}history/${year}.html`,
    `${baseUrl}${year}.html`,
  ];

  for (const url of urlsToTry) {
    const response = await fetchWithRetry(url);
    if (response) {
      const text = await response.text();
      if (new RegExp('ball', 'i').test(text) && text.includes('六合彩')) {
        return text;
      }
    }
    await sleep(1000);
  }

  return null;
}

export function extractDataFromYear(html: string, year: number): LotteryRecord[] | null {
  if (!html) return null;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const ballElements = doc.querySelectorAll('[class*="ball"], .number, .lottery-number');
  const numbers: number[] = [];

  ballElements.forEach(elem => {
    const text = elem.textContent?.trim();
    if (text && /^\d+$/.test(text)) {
      const num = parseInt(text);
      if (num >= 1 && num <= 49) {
        numbers.push(num);
      }
    }
  });

  const datePattern = new RegExp('六合彩开奖记录.*?(\\d{4})年(\\d{2})月(\\d{2})日.*?第(\\d{3})期');
  const dates: string[] = [];
  const issues: string[] = [];

  const allElements = doc.querySelectorAll('*');
  allElements.forEach(elem => {
    const text = elem.textContent || '';
    const match = datePattern.exec(text);
    if (match) {
      const [_, y, m, d, issue] = match;
      if (parseInt(y) === year) {
        dates.push(`${y}-${m}-${d}`);
        issues.push(issue);
      }
    }
  });

  if (numbers.length >= 7) {
    const numDraws = Math.floor(numbers.length / 7);
    const usedDates = dates.length >= numDraws
      ? dates.slice(0, numDraws)
      : Array.from({ length: numDraws }, (_, i) => {
          const month = Math.floor(i / 30) + 1;
          const day = (i % 30) + 1;
          return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        });
    const usedIssues = issues.length >= numDraws
      ? issues.slice(0, numDraws)
      : Array.from({ length: numDraws }, (_, i) => String(i + 1).padStart(3, '0'));

    const draws: LotteryRecord[] = [];

    for (let i = 0; i < numDraws; i++) {
      const drawNums = numbers.slice(i * 7, (i + 1) * 7);
      if (drawNums.length === 7) {
        const specialNum = drawNums[6];
        const specialZodiac = getZodiacForCrawler(new Date(year, 0, 1), specialNum);

        draws.push({
          Date: usedDates[i],
          Year: year,
          Issue: usedIssues[i],
          Num1: drawNums[0],
          Num2: drawNums[1],
          Num3: drawNums[2],
          Num4: drawNums[3],
          Num5: drawNums[4],
          Num6: drawNums[5],
          Special: specialNum,
          Special_Zodiac: specialZodiac,
        });
      }
    }

    return draws;
  }

  return null;
}

export function getLatestDateFromStorage(): Date | null {
  try {
    const data = localStorage.getItem('lottery_data');
    if (data) {
      const records = JSON.parse(data);
      if (records.length > 0) {
        const dates = records.map((r: { date: string }) => new Date(r.date));
        return new Date(Math.max(...dates.map((d: Date) => d.getTime())));
      }
    }
  } catch (error) {
    console.error('读取本地数据失败:', error);
  }
  return null;
}

export async function updateLotteryDataIncremental(
  onProgress?: (current: number, total: number, year: number) => void,
  onComplete?: (totalRecords: number) => void
): Promise<boolean> {
  const today = new Date();
  const latestLocal = getLatestDateFromStorage();
  let allNewData: LotteryRecord[] = [];

  if (latestLocal) {
    const startYear = latestLocal.getFullYear();
    for (let year = startYear; year <= today.getFullYear(); year++) {
      if (onProgress) onProgress(0, 100, year);
      const html = await fetchYearData(year);
      if (html) {
        const yearData = extractDataFromYear(html, year);
        if (yearData) {
          const filtered = yearData.filter(r => new Date(r.Date) > latestLocal);
          allNewData.push(...filtered);
        }
      }
      await sleep(1000);
    }
    if (onProgress) onProgress(100, 100, today.getFullYear());
  } else {
    const startYear = 2020;
    for (let year = startYear; year <= today.getFullYear(); year++) {
      if (onProgress) onProgress(0, 150, year);
      const html = await fetchYearData(year);
      if (html) {
        const yearData = extractDataFromYear(html, year);
        if (yearData) allNewData.push(...yearData);
      }
      await sleep(2000 + Math.random() * 3000);
    }
    if (onProgress) onProgress(100, 150, today.getFullYear());
  }

  if (allNewData.length > 0) {
    let finalData: any[] = [];
    try {
      const existingData = JSON.parse(localStorage.getItem('lottery_data') || '[]');
      finalData = [...existingData, ...allNewData];
    } catch {
      finalData = [...allNewData];
    }
    finalData = finalData.filter((record: LotteryRecord, index: number, self: LotteryRecord[]) =>
      index === self.findIndex((r: LotteryRecord) => r.Date === record.Date)
    ).sort((a: LotteryRecord, b: LotteryRecord) => a.Date.localeCompare(b.Date));
    localStorage.setItem('lottery_data', JSON.stringify(finalData));
    if (onComplete) onComplete(finalData.length);
    return true;
  }
  return false;
}

function getZodiacForCrawler(date: Date, number: number): string {
  return getZodiacByNumber(date, number);
}
