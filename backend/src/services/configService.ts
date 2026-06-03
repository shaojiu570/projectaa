import fs from 'fs/promises';
import path from 'path';

/**
 * 配置管理服务
 * 支持从默认 JSON 文件读取并应用自定义设置
 */
export class ConfigService {
  private configPath: string;
  private configData: any = {};

  constructor() {
    this.configPath = path.join(process.cwd(), 'config', 'default.json');
    this.loadConfig();
  }

  private async loadConfig() {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      this.configData = JSON.parse(data);
    } catch (error) {
      console.warn('无法加载配置文件，使用内存默认设置:', error);
      this.configData = {
        crawler: {
          defaultSource: 'https://kj.123720c.com/kj/',
          timeout: 30000,
          retry: { maxRetries: 3, backoffFactor: 1.5 },
          delay: { min: 2000, max: 5000 }
        }
      };
    }
  }

  get<T>(key: string, defaultValue?: T): T {
    const keys = key.split('.');
    let value = this.configData;
    for (const k of keys) {
      if (value[k] === undefined) return defaultValue as T;
      value = value[k];
    }
    return value;
  }

  /**
   * 动态更新配置 (单人开发方便调试)
   */
  async updateConfig(newConfig: any) {
    this.configData = { ...this.configData, ...newConfig };
    await fs.writeFile(this.configPath, JSON.stringify(this.configData, null, 2));
  }
}

export const configService = new ConfigService();
