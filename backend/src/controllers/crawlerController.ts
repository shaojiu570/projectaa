import { Request, Response } from 'express';
import { CrawlerService } from '../services/crawlerService';
import { ApiResponse, LotteryRecord, CrawlerTask } from '../types/lottery';

interface CrawlerRequest {
  source: string;
  startYear: number;
  endYear?: number;
}

export class CrawlerController {
  private crawlerService: CrawlerService;

  constructor() {
    this.crawlerService = new CrawlerService();
  }

  // 启动爬虫任务
  async startCrawler(req: Request, res: Response): Promise<void> {
    try {
      const { source, startYear, endYear }: CrawlerRequest = req.body;

      // 验证参数
      if (!source || !startYear) {
        res.status(400).json({
          success: false,
          message: '缺少必要参数: source 和 startYear'
        });
        return;
      }

      if (startYear < 2000 || startYear > new Date().getFullYear()) {
        res.status(400).json({
          success: false,
          message: '年份范围无效'
        });
        return;
      }

      const taskId = await this.crawlerService.startCrawlerTask(source, startYear, endYear);

      const response: ApiResponse = {
        success: true,
        data: { taskId },
        message: '爬虫任务已启动'
      };

      res.json(response);
    } catch (error) {
      console.error('启动爬虫失败:', error);
      res.status(500).json({
        success: false,
        message: '启动爬虫失败',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // 查询任务状态
  async getTaskStatus(req: Request, res: Response): Promise<void> {
    try {
      const { taskId } = req.params;

      if (!taskId) {
        res.status(400).json({
          success: false,
          message: '缺少任务ID'
        });
        return;
      }

      const task = this.crawlerService.getTaskStatus(taskId);

      if (!task) {
        res.status(404).json({
          success: false,
          message: '任务不存在'
        });
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: task
      };

      res.json(response);
    } catch (error) {
      console.error('查询任务状态失败:', error);
      res.status(500).json({
        success: false,
        message: '查询任务状态失败',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // 获取所有任务
  async getAllTasks(req: Request, res: Response): Promise<void> {
    try {
      const tasks = this.crawlerService.getAllTasks();

      const response: ApiResponse = {
        success: true,
        data: tasks
      };

      res.json(response);
    } catch (error) {
      console.error('查询任务状态失败:', error);
      res.status(500).json({
        success: false,
        message: '查询任务状态失败',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // 导出数据
  async exportData(format: 'json' | 'csv'): Promise<any> {
    try {
      return await this.crawlerService.exportData(format);
    } catch (error) {
      console.error('导出数据失败:', error);
      throw error;
    }
  }

  // 获取数据统计
  async getDataStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.crawlerService.getDataStats();

      const response: ApiResponse = {
        success: true,
        data: stats
      };

      res.json(response);
    } catch (error) {
      console.error('获取统计信息失败:', error);
      res.status(500).json({
        success: false,
        message: '获取统计信息失败',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // 优雅清理
  async cleanup(): Promise<void> {
    await this.crawlerService.cleanup();
  }
}
