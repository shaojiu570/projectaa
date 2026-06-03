import { Router } from 'express';

const router = Router();

// 健康检查接口
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    message: 'Backend service is running'
  });
});

export default router;
