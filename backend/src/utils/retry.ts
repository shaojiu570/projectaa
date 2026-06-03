import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryCondition?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

export class RetryService {
  static async fetchWithRetry<T = any>(
    config: AxiosRequestConfig,
    retryConfig: Partial<RetryConfig> = {}
  ): Promise<AxiosResponse<T>> {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      retryCondition = (error) => {
        // 默认重试条件：网络错误或5xx状态码
        return !error.response || (error.response.status >= 500 && error.response.status <= 504);
      },
      onRetry
    } = retryConfig;

    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios(config);
        return response;
      } catch (error) {
        lastError = error;

        // 检查是否应该重试
        if (attempt === maxRetries || !retryCondition(error)) {
          throw error;
        }

        // 计算延迟时间（指数退避 + 随机抖动）
        const delay = retryDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        
        if (onRetry) {
          onRetry(attempt, error);
        }

        console.log(`请求失败，${delay}ms后重试 (第${attempt}次)`);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 生成随机User-Agent
  static getRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/120.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    ];
    
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  // 生成随机延迟
  static randomDelay(min: number = 1000, max: number = 3000): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    return this.sleep(delay);
  }
}
