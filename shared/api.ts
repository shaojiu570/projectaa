import { ApiResponse, CrawlerTask } from './types';

/**
 * 统一 API 客户端
 */
export const api = {
  /**
   * 启动爬虫任务
   */
  async startCrawler(source: string, startYear: number, endYear?: number): Promise<ApiResponse<{ taskId: string }>> {
    const response = await fetch('/api/crawler/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, startYear, endYear }),
    });
    return response.json();
  },

  /**
   * 获取任务状态
   */
  async getTaskStatus(taskId: string): Promise<ApiResponse<CrawlerTask>> {
    const response = await fetch(`/api/crawler/status/${taskId}`);
    return response.json();
  },

  /**
   * 获取所有任务
   */
  async getAllTasks(): Promise<ApiResponse<CrawlerTask[]>> {
    const response = await fetch('/api/crawler/tasks');
    return response.json();
  },

  /**
   * 导出数据
   */
  async exportData(format: 'json' | 'csv' = 'json'): Promise<Blob> {
    const response = await fetch(`/api/data/export?format=${format}`);
    return response.blob();
  },

  /**
   * 获取数据统计
   */
  async getDataStats(): Promise<ApiResponse<any>> {
    const response = await fetch('/api/data/stats');
    return response.json();
  },

  /**
   * 健康检查
   */
  async checkHealth(): Promise<ApiResponse> {
    const response = await fetch('/health');
    return response.json();
  },

  /**
   * 获取配置
   */
  async getConfig(): Promise<ApiResponse<any>> {
    const response = await fetch('/api/config');
    return response.json();
  },

  /**
   * 更新配置
   */
  async updateConfig(config: any): Promise<ApiResponse<any>> {
    const response = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return response.json();
  }
};
