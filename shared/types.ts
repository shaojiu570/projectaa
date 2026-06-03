/**
 * 核心开奖记录接口
 */
export interface LotteryRecord {
  Date: string;
  Year: number;
  Issue?: string;
  Num1: number;
  Num2: number;
  Num3: number;
  Num4: number;
  Num5: number;
  Num6: number;
  Special: number;
  Special_Zodiac: string;
}

/**
 * 爬虫任务状态
 */
export interface CrawlerTask {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: {
    current: number;
    total: number;
    year: number;
  };
  source: string;
  startYear: number;
  endYear: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

/**
 * API 统一响应格式
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
