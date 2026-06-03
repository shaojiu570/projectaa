import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { CrawlerController } from './controllers/crawlerController';
import healthRoutes from './routes/health';

import { configService } from './services/configService';

const app = express();
const PORT = process.env.PORT || 3001;

// 创建爬虫控制器实例
const crawlerController = new CrawlerController();

// 安全中间件
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // 前端地址
  credentials: true
}));

// 限流中间件
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制每个IP 100个请求
  message: {
    success: false,
    message: '请求过于频繁，请稍后再试'
  }
});
app.use('/api', limiter);

// 解析JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API路由

// 健康检查路由
app.use('/api', healthRoutes);

// 配置相关路由
app.get('/api/config', (req, res) => {
  res.json({ success: true, data: configService.get('') });
});

app.post('/api/config', async (req, res) => {
  await configService.updateConfig(req.body);
  res.json({ success: true, message: '配置已更新' });
});

// 爬虫相关路由
app.post('/api/crawler/start', crawlerController.startCrawler.bind(crawlerController));
app.get('/api/crawler/status/:taskId', crawlerController.getTaskStatus.bind(crawlerController));
app.get('/api/crawler/tasks', crawlerController.getAllTasks.bind(crawlerController));

// 数据相关路由
app.get('/api/data/export', async (req, res) => {
  const format = (req.query.format as 'json' | 'csv') || 'json';
  const data = await crawlerController.exportData(format);
  
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=data.csv');
    return res.send(data);
  }
  
  res.json({ success: true, data });
});

app.get('/api/data/stats', crawlerController.getDataStats.bind(crawlerController));

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '服务运行正常',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

// 错误处理中间件
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('服务器错误:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('收到 SIGTERM 信号，开始优雅关闭...');
  await crawlerController.cleanup();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('收到 SIGINT 信号，开始优雅关闭...');
  await crawlerController.cleanup();
  process.exit(0);
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 服务器启动成功`);
  console.log(`📍 地址: http://localhost:${PORT}`);
  console.log(`🏥 健康检查: http://localhost:${PORT}/health`);
  console.log(`🕷️  爬虫API: http://localhost:${PORT}/api/crawler`);
});

export default app;
