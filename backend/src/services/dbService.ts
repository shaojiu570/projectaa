import fs from 'fs/promises';
import path from 'path';
import { LotteryRecord } from '../types/lottery';

/**
 * 简易数据库服务 (单人开发推荐初始方案)
 * 后续可轻松替换为 Supabase 或 MongoDB
 */
export class DbService {
  private dbPath: string;

  constructor() {
    this.dbPath = path.join(process.cwd(), 'data', 'lottery_db.json');
    this.initDb();
  }

  private async initDb() {
    try {
      const dataDir = path.dirname(this.dbPath);
      await fs.mkdir(dataDir, { recursive: true });
      try {
        await fs.access(this.dbPath);
      } catch {
        await fs.writeFile(this.dbPath, JSON.stringify([], null, 2));
      }
    } catch (error) {
      console.error('数据库初始化失败:', error);
    }
  }

  /**
   * 保存开奖记录 (去重)
   */
  async saveRecords(records: LotteryRecord[]): Promise<number> {
    const existing = await this.getAllRecords();
    const existingMap = new Map(existing.map(r => [`${r.Year}-${r.Date}`, r]));
    
    let newCount = 0;
    records.forEach(record => {
      const key = `${record.Year}-${record.Date}`;
      if (!existingMap.has(key)) {
        existingMap.set(key, record);
        newCount++;
      }
    });

    if (newCount > 0) {
      const updated = Array.from(existingMap.values()).sort((a, b) => 
        new Date(b.Date).getTime() - new Date(a.Date).getTime()
      );
      await fs.writeFile(this.dbPath, JSON.stringify(updated, null, 2));
    }

    return newCount;
  }

  /**
   * 获取所有记录
   */
  async getAllRecords(): Promise<LotteryRecord[]> {
    try {
      const data = await fs.readFile(this.dbPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  /**
   * 获取统计信息
   */
  async getStats() {
    const records = await this.getAllRecords();
    return {
      totalRecords: records.length,
      lastUpdate: records.length > 0 ? records[0].Date : null,
      years: [...new Set(records.map(r => r.Year))].sort((a, b) => b - a)
    };
  }
}

export const dbService = new DbService();
