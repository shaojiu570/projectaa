const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const isDev = process.env.NODE_ENV === 'development';

let backendProcess = null;
let mainWindow = null;

function startBackend() {
  console.log('Starting backend service...');
  
  if (isDev) {
    // 开发环境：启动后端开发服务器
    backendProcess = spawn('npm', ['run', 'dev:backend'], {
      cwd: path.join(__dirname),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });
  } else {
    // 生产环境：使用 Node.js 内置的 http 模块创建简单服务器
    console.log('Starting simple backend server...');
    
    const http = require('http');
    const url = require('url');
    const PORT = 3001;
    
    // CORS 头
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    
    const server = http.createServer((req, res) => {
      // 添加 CORS 头
      Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
      
      const parsedUrl = url.parse(req.url, true);
      const pathname = parsedUrl.pathname;
      
      // 健康检查
      if (pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          message: 'Backend service is running'
        }));
        return;
      }
      
      // 配置接口
      if (pathname === '/api/config') {
        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: {} }));
        } else if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: '配置已更新' }));
          });
        }
        return;
      }
      
      // 爬虫接口 - 启动
      if (pathname === '/api/crawler/start' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const { source, year, sourceName } = JSON.parse(body);
            console.log(`开始爬取: ${sourceName || source}, 年份: ${year}`);
            
            // 直接返回URL信息，让前端发起请求
            const urlsToTry = [
              source + year + '/',
              source + '?year=' + year,
              source + 'index_' + year + '.html',
              source + 'history/' + year + '.html',
              source + year + '.html',
              source
            ];
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: true, 
              data: { 
                taskId: 'crawl-' + Date.now(),
                urls: urlsToTry,
                baseUrl: source
              },
              message: '准备就绪，请前端发起请求'
            }));
          } catch (error) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: false, 
              message: '爬取失败: ' + error.message 
            }));
          }
        });
        return;
      }
      
      // 爬虫接口 - 前端直接请求数据
      if (pathname === '/api/crawler/fetch' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const { url } = JSON.parse(body);
            console.log(`前端直接爬取: ${url}`);
            
            const html = await fetchUrlDirect(url);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: true, 
              data: { html: html }
            }));
          } catch (error) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: false, 
              message: '获取失败: ' + error.message 
            }));
          }
        });
        return;
      }
      
      // 爬取函数 - 参考Python实现
      async function crawlLotteryData(baseUrl, year) {
        const https = require('https');
        const http = require('http');
        
        const USER_AGENTS = [
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];
        
        // 尝试多个可能的URL
        const urlsToTry = [
          `${baseUrl}${year}/`,
          `${baseUrl}?year=${year}`,
          `${baseUrl}index_${year}.html`,
          `${baseUrl}history/${year}.html`,
          `${baseUrl}${year}.html`,
          baseUrl
        ];
        
        let html = null;
        
        for (const url of urlsToTry) {
          console.log(`尝试URL: ${url}`);
          try {
            html = await fetchUrl(url, USER_AGENTS);
            if (html && html.includes('ball')) {
              console.log(`找到有效数据: ${url}`);
              break;
            }
          } catch (e) {
            console.log(`URL失败: ${url}, ${e.message}`);
          }
        }
        
        if (!html) {
          throw new Error('所有URL尝试失败');
        }
        
        return parseLotteryHtml(html, year);
      }
      
      // 带重试的fetch
      function fetchUrl(urlStr, userAgents, retries = 3) {
        return new Promise((resolve, reject) => {
          let attempts = 0;
          
          function tryFetch() {
            attempts++;
            const urlObj = new URL(urlStr);
            const client = urlObj.protocol === 'https:' ? https : http;
            const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
            
            const options = {
              hostname: urlObj.hostname,
              path: urlObj.pathname + urlObj.search,
              method: 'GET',
              headers: {
                'User-Agent': randomUA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Connection': 'keep-alive'
              },
              timeout: 15000
            };
            
            const req = client.request(options, (res) => {
              let data = '';
              res.on('data', chunk => data += chunk);
              res.on('end', () => {
                if (res.statusCode === 200) {
                  resolve(data);
                } else if (attempts < retries) {
                  console.log(`状态码 ${res.statusCode}，重试...`);
                  setTimeout(tryFetch, 1000 * attempts);
                } else {
                  reject(new Error(`HTTP ${res.statusCode}`));
                }
              });
            });
            
            req.on('error', (e) => {
              if (attempts < retries) {
                console.log(`请求错误，重试...`);
                setTimeout(tryFetch, 1000 * attempts);
              } else {
                reject(e);
              }
            });
            
            req.on('timeout', () => {
              req.destroy();
              if (attempts < retries) {
                setTimeout(tryFetch, 1000 * attempts);
              } else {
                reject(new Error('请求超时'));
              }
            });
            
            req.end();
          }
          
          tryFetch();
        });
      }
      
      // 解析HTML - 参考Python的extract_data_from_year
      function parseLotteryHtml(html, targetYear) {
        const records = [];
        
        // 查找所有ball类元素（开奖号码）
        const ballRegex = /class=["']?[^"']*ball[^"']*["']?/gi;
        const ballMatches = html.match(ballRegex) || [];
        
        // 提取所有数字
        const numbers = [];
        const numRegex = /\b([1-9]|[1-3][0-9]|4[0-9])\b/g;
        let match;
        while ((match = numRegex.exec(html)) !== null) {
          const n = parseInt(match[0]);
          if (n >= 1 && n <= 49) {
            numbers.push(n);
          }
        }
        
        // 查找日期 - 匹配 年月日 格式
        const dateRegex = /(\d{4})年(\d{1,2})月(\d{1,2})日/g;
        const dates = [];
        while ((match = dateRegex.exec(html)) !== null) {
          const y = parseInt(match[1]);
          if (y >= 2020 && y <= 2026) {
            const m = parseInt(match[2]);
            const d = parseInt(match[3]);
            dates.push(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
          }
        }
        
        // 每7个号码为一期
        if (numbers.length >= 7) {
          const numDraws = Math.floor(numbers.length / 7);
          
          for (let i = 0; i < numDraws; i++) {
            const drawNums = numbers.slice(i * 7, (i + 1) * 7);
            if (drawNums.length === 7) {
              // 使用找到的日期，如果没有则生成
              const date = dates[i] || generateDate(targetYear, i, numDraws);
              
              records.push({
                issue: date.replace(/-/g, ''),
                date: date,
                normals: drawNums.slice(0, 6),
                special: drawNums[6]
              });
            }
          }
        }
        
        // 如果没找到数据，抛出错误
        if (records.length === 0) {
          throw new Error('未找到开奖数据，页面结构可能已变化');
        }
        
        // 按日期排序
        records.sort((a, b) => a.date.localeCompare(b.date));
        
        console.log(`解析到 ${records.length} 条记录`);
        return records;
      }
      
      // 生成日期
      function generateDate(year, index, total) {
        const startMonth = 1;
        const monthLengths = [31,28,31,30,31,30,31,31,30,31,30,31];
        let remaining = index;
        
        for (let m = startMonth; m <= 12; m++) {
          const days = monthLengths[m-1];
          if (remaining < days) {
            return `${year}-${String(m).padStart(2,'0')}-${String(remaining+1).padStart(2,'0')}`;
          }
          remaining -= days;
        }
        
        return `${year}-12-31`;
      }
      
      // 前端直接请求用的函数
      function fetchUrlDirect(urlStr) {
        return new Promise((resolve, reject) => {
          const https = require('https');
          const http = require('http');
          
          const urlObj = new URL(urlStr);
          const client = urlObj.protocol === 'https:' ? https : http;
          
          const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
              'Referer': urlObj.origin
            },
            timeout: 20000
          };
          
          const req = client.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              console.log(`获取成功: ${urlStr}, 状态码: ${res.statusCode}, 长度: ${data.length}`);
              resolve(data);
            });
          });
          
          req.on('error', (e) => {
            console.log(`请求错误: ${e.message}`);
            reject(e);
          });
          
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
          });
          
          req.end();
        });
      }
      
      // 爬虫接口 - 状态查询 (匹配 /api/crawler/status/xxx)
      if (pathname.startsWith('/api/crawler/status/') && pathname.split('/api/crawler/status/')[1]) {
        const taskId = pathname.split('/api/crawler/status/')[1];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          data: {
            id: taskId,
            status: 'completed',
            progress: { current: 10, total: 10, year: 2024 }
          }
        }));
        return;
      }
      
      // 爬虫接口 - 任务列表
      if (pathname === '/api/crawler/tasks') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: [] }));
        return;
      }
      
      // 数据导出接口
      if (pathname === '/api/data/export') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: [] }));
        return;
      }
      
      // 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });
    
    server.listen(PORT, () => {
      console.log(`🚀 简化后端启动成功`);
      console.log(`📍 地址: http://localhost:${PORT}`);
      console.log(`🏥 健康检查: http://localhost:${PORT}/api/health`);
    });
    
    backendProcess = {
      kill: () => {
        console.log('Stopping simple backend server...');
        server.close();
      },
      on: (event, handler) => {
        if (event === 'close') {
          server.on('close', handler);
        }
      }
    };
  }

  // 通用事件处理
  backendProcess.stdout && backendProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    console.log(`Backend STDOUT: ${output}`);
  });

  backendProcess.stderr && backendProcess.stderr.on('data', (data) => {
    const output = data.toString().trim();
    console.error(`Backend STDERR: ${output}`);
  });

  backendProcess.on && backendProcess.on('error', (error) => {
    console.error(`Backend error: ${error.message}`);
  });

  backendProcess.on && backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code: ${code}`);
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    title: '六合彩特码预测系统',
    show: false
  });

  // 加载应用
  let startUrl;
  if (isDev) {
    startUrl = 'http://localhost:5173';
  } else {
    // 生产环境：index.html 打包在 app.asar 内的 dist/ 目录
    // app.getAppPath() 返回 asar 包路径，Electron 会自动处理 asar 内部文件
    const appPath = app.getAppPath();
    const indexPath = path.join(appPath, 'dist', 'index.html');
    console.log('Loading from:', indexPath);
    startUrl = `file://${indexPath.replace(/\\/g, '/')}`;
  }
  
  mainWindow.loadURL(startUrl);

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 开发环境下打开开发者工具
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 应用准备就绪时创建窗口和启动后端
app.whenReady().then(() => {
  startBackend();
  
  // 等待更长时间让后端完全启动
  setTimeout(() => {
    createWindow();
  }, 8000);
});

// 当所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// macOS 上点击 dock 图标时重新创建窗口
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 应用退出前清理
app.on('before-quit', () => {
  stopBackend();
});

// 设置应用名称
app.setName('六合彩特码预测系统');
