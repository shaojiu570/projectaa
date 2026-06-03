import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { LotteryRecord, CrawlerTask, CrawlerRequest, ApiResponse } from '../types/lottery';
import { RetryService } from '../utils/retry';
import { dbService } from './dbService';
import { configService } from './configService';
import { getZodiacByNumber } from '../utils/lunarCalendar';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';

export class CrawlerService {
  private browser: Browser | null = null;
  private tasks: Map<string, CrawlerTask> = new Map();

  constructor() {
    this.initBrowser();
  }

  private async initBrowser(): Promise<void> {
    try {
      const timeout = configService.get('crawler.timeout', 30000);
      this.browser = await puppeteer.launch({
        headless: "new",
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });
      
      // 定期重启浏览器避免内存泄漏
      setInterval(async () => {
        if (this.browser) {
          try {
            await this.browser.close();
          } catch (e) {}
          await this.initBrowser();
        }
      }, 30 * 60 * 1000); // 30分钟重启一次
    } catch (error) {
      console.error('浏览器初始化失败:', error);
    }
  }

  async startCrawlerTask(source: string, startYear: number, endYear?: number): Promise<string> {
    const taskId = uuidv4();
    const task: CrawlerTask = {
      id: taskId,
      status: 'pending',
      progress: { current: 0, total: 0, year: startYear },
      source: source || configService.get('crawler.defaultSource'),
      startYear,
      endYear: endYear || new Date().getFullYear(),
      createdAt: new Date().toISOString()
    };

    this.tasks.set(taskId, task);
    
    // 异步执行爬取任务
    this.runCrawlerTask(taskId).catch(error => {
      console.error(`任务 ${taskId} 执行失败:`, error);
      const currentTask = this.tasks.get(taskId);
      if (currentTask) {
        currentTask.status = 'failed';
        currentTask.error = error.message;
      }
    });

    return taskId;
  }

  private async runCrawlerTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'running';
    const allData: LotteryRecord[] = [];
    const delayMin = configService.get('crawler.delay.min', 2000);
    const delayMax = configService.get('crawler.delay.max', 5000);

    try {
      for (let year = task.startYear; year <= task.endYear; year++) {
        task.progress.year = year;
        
        console.log(`\n📆 正在处理 ${year} 年...`);
        const yearData = await this.crawlYearData(year, task.source);
        
        if (yearData && yearData.length > 0) {
          allData.push(...yearData);
          task.progress.current += yearData.length;
          console.log(`  ✅ ${year} 年新增 ${yearData.length} 期`);
        } else {
          console.log(`  ⚠️ ${year} 年未获取到数据`);
        }

        // 年份间延迟
        await RetryService.randomDelay(delayMin, delayMax);
      }

      // 保存数据到数据库
      await this.saveData(allData);
      
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      task.progress.total = allData.length;

    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private async saveData(data: LotteryRecord[]): Promise<void> {
    const newCount = await dbService.saveRecords(data);
    console.log(`\n💾 数据已更新，成功保存 ${newCount} 条新记录 (总爬取 ${data.length} 条)`);
  }

  getTaskStatus(taskId: string): CrawlerTask | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): CrawlerTask[] {
    return Array.from(this.tasks.values());
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async exportData(format: 'json' | 'csv' = 'json'): Promise<any> {
    const records = await dbService.getAllRecords();
    if (format === 'csv') {
      if (records.length === 0) return '';
      const headers = Object.keys(records[0]).join(',');
      const rows = records.map(r => Object.values(r).join(',')).join('\n');
      return `${headers}\n${rows}`;
    }
    return records;
  }

  async getDataStats(): Promise<any> {
    return await dbService.getStats();
  }

  private async crawlYearData(year: number, baseUrl: string): Promise<LotteryRecord[]> {
    // 策略 1：直接尝试多个 URL (移植 Python 逻辑)
    const urlsToTry = [
      `${baseUrl}${year}/`,
      `${baseUrl}?year=${year}`,
      `${baseUrl}index_${year}.html`,
      `${baseUrl}history/${year}.html`,
      `${baseUrl}${year}.html`
    ];

    for (const url of urlsToTry) {
      try {
        console.log(`尝试直接获取: ${url}`);
        const response = await RetryService.fetchWithRetry({
          method: 'GET',
          url,
          timeout: 15000,
          headers: {
            'User-Agent': RetryService.getRandomUserAgent()
          }
        });

        if (response.status === 200 && response.data) {
          const records = this.parseHtml(response.data, year);
          if (records.length > 0) {
            console.log(`  ✅ 通过 URL 找到数据: ${url}`);
            return records;
          }
        }
      } catch (error) {
        // 忽略单个 URL 失败，继续尝试下一个
      }
    }

    // 策略 2：如果直接获取失败，使用 Puppeteer 模拟点击 (作为兜底)
    console.log(`直接获取失败，尝试使用 Puppeteer 模拟点击...`);
    return await this.crawlWithPuppeteer(year, baseUrl);
  }

  private async crawlWithPuppeteer(year: number, baseUrl: string): Promise<LotteryRecord[]> {
    if (!this.browser) return [];
    const page: Page = await this.browser.newPage();
    try {
      await page.setUserAgent(RetryService.getRandomUserAgent());
      await page.setViewport({ width: 1920, height: 1080 });

      console.log(`访问主页: ${baseUrl}`);
      await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      console.log(`尝试寻找 ${year} 年按钮...`);
      const yearText = `${year}`;
      const yearButtons = await page.$x(`//a[contains(text(), "${yearText}")] | //button[contains(text(), "${yearText}")] | //span[contains(text(), "${yearText}")]`);
      
      if (yearButtons.length > 0) {
        const button = yearButtons[0] as any;
        await button.click();
        console.log(`已点击，等待 3 秒加载数据...`);
        await RetryService.sleep(3000);
        const html = await page.content();
        return this.parseHtml(html, year);
      }
    } catch (error) {
      console.error(`Puppeteer 爬取 ${year} 年失败:`, error instanceof Error ? error.message : String(error));
    } finally {
      await page.close();
    }
    return [];
  }

  private parseHtml(html: string, year: number): LotteryRecord[] {
    const $ = cheerio.load(html);
    const records: LotteryRecord[] = [];

    // 获取所有行，kj.123720c.com 的数据通常在 tr 中
    $('tr').each((_, tr) => {
      const $tr = $(tr);
      const text = $tr.text().trim();
      
      // 匹配日期格式: 2024-01-01 或 2024/01/01
      const dateMatch = text.match(/(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})/);
      if (dateMatch) {
        const [_, y, m, d] = dateMatch;
        if (parseInt(y) === year) {
          const dateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          
          // 在当前行寻找号码和期数
          const numbers: number[] = [];
          let issue = '';
          
          $tr.find('[class*="ball" i], [class*="num" i], td').each((_, el) => {
            const numText = $(el).text().trim();
            if (/^\d+$/.test(numText)) {
              const num = parseInt(numText);
              // 如果是一个较大的数字（如 2024076 或 076），且在 numbers 为空时出现，可能是期数
              if (numText.length >= 3 && numbers.length === 0) {
                issue = numText;
              } else if (num >= 1 && num <= 49) {
                numbers.push(num);
              }
            }
          });

          // 六合彩通常有 7 个号码
          if (numbers.length >= 7) {
            // 取最后 7 个数字（防止前面有期数干扰）
            const drawNums = numbers.slice(-7);
            const specialNum = drawNums[6];
            
            // 如果没抓到期数，用日期生成一个兜底
            if (!issue) {
              issue = `${y}${m.padStart(2, '0')}${d.padStart(2, '0')}`;
            }

            records.push({
              Date: dateStr,
              Year: year,
              Issue: issue,
              Num1: drawNums[0],
              Num2: drawNums[1],
              Num3: drawNums[2],
              Num4: drawNums[3],
              Num5: drawNums[4],
              Num6: drawNums[5],
              Special: specialNum,
              Special_Zodiac: getZodiacByNumber(new Date(dateStr), specialNum)
            });
          }
        }
      }
    });

    // 如果表格解析失败，使用原有的备选逻辑（每 7 个数字一组）
    if (records.length === 0) {
      const numbers: number[] = [];
      $('[class*="ball" i], [class*="num" i]').each((_, el) => {
        const text = $(el).text().trim();
        if (/^\d+$/.test(text)) {
          const num = parseInt(text);
          if (num >= 1 && num <= 49) numbers.push(num);
        }
      });

      const datePattern = /(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})/g;
      const dates: string[] = [];
      let match;
      const textContent = $.text();
      while ((match = datePattern.exec(textContent)) !== null) {
        const [_, y, m, d] = match;
        if (parseInt(y) === year) {
          dates.push(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
        }
      }

      if (numbers.length >= 7 && dates.length > 0) {
        const numDraws = Math.min(dates.length, Math.floor(numbers.length / 7));
        for (let i = 0; i < numDraws; i++) {
          const drawNums = numbers.slice(i * 7, (i + 1) * 7);
          const dateStr = dates[i];
          const specialNum = drawNums[6];
          records.push({
            Date: dateStr,
            Year: year,
            Issue: String(i + 1).padStart(3, '0'),
            Num1: drawNums[0],
            Num2: drawNums[1],
            Num3: drawNums[2],
            Num4: drawNums[3],
            Num5: drawNums[4],
            Num6: drawNums[5],
            Special: specialNum,
            Special_Zodiac: getZodiacByNumber(new Date(dateStr), specialNum)
          });
        }
      }
    }

    return records;
  }
}
