export interface LotteryRecord {
  Date: string;
  Year: number;
  Issue: string;        // 期数 (如: "078")
  Num1: number;
  Num2: number;
  Num3: number;
  Num4: number;
  Num5: number;
  Num6: number;
  Special: number;
  Special_Zodiac: string;
}

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

export interface CrawlerRequest {
  source: string;
  startYear: number;
  endYear?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface DataQuery {
  startDate?: string;
  endDate?: string;
  format?: 'json' | 'csv';
  limit?: number;
  offset?: number;
}
