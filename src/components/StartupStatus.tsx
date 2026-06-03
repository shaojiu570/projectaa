import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

interface StatusProps {
  onBackendReady: () => void;
}

export default function StartupStatus({ onBackendReady }: StatusProps) {
  const [status, setStatus] = useState<'starting' | 'ready' | 'error'>('starting');
  const [message, setMessage] = useState('正在启动后端服务...');
  const [retryCount, setRetryCount] = useState(0);
  const [errorDetails, setErrorDetails] = useState('');

  useEffect(() => {
    const checkBackend = async () => {
      try {
        console.log(`Checking backend health (attempt ${retryCount + 1}/10)...`);
        const response = await fetch('http://localhost:3001/api/health');
        console.log('Health check response:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Health check data:', data);
          setStatus('ready');
          setMessage('后端服务已就绪');
          setTimeout(() => onBackendReady(), 1000);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Health check failed:', errorMessage);
        setErrorDetails(errorMessage);
        
        if (retryCount < 10) {
          setTimeout(checkBackend, 2000);
          setRetryCount(prev => prev + 1);
          setMessage(`正在启动后端服务... (尝试 ${retryCount + 1}/10)`);
        } else {
          setStatus('error');
          setMessage('后端启动失败，请检查网络或重启应用');
        }
      }
    };

    const timer = setTimeout(checkBackend, 3000);
    return () => clearTimeout(timer);
  }, [retryCount, onBackendReady]);

  const handleRetry = () => {
    setStatus('starting');
    setRetryCount(0);
    setErrorDetails('');
    setMessage('正在重新启动后端服务...');
    setTimeout(() => window.location.reload(), 1000);
  };

  if (status === 'ready') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">系统启动完成</h2>
          <p className="text-gray-600 mb-4">{message}</p>
          <div className="animate-pulse text-sm text-gray-500">
            正在进入主界面...
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">启动失败</h2>
          <p className="text-gray-600 mb-4">{message}</p>
          {errorDetails && (
            <div className="mb-4 p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-red-600">错误详情: {errorDetails}</p>
            </div>
          )}
          <div className="space-y-2">
            <button 
              onClick={handleRetry}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              重新启动
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg"
            >
              刷新页面
            </button>
          </div>
          <div className="mt-4 text-xs text-gray-500">
            <p>如果问题持续存在，请检查：</p>
            <ul className="text-left mt-2 space-y-1">
              <li>• 防火墙是否阻止了应用</li>
              <li>• 端口3001是否被占用</li>
              <li>• 重新安装应用</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <Loader2 className="w-16 h-16 text-indigo-500 mx-auto mb-4 animate-spin" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">系统启动中</h2>
        <p className="text-gray-600 mb-4">{message}</p>
        <div className="space-y-2">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
          <p className="text-sm text-gray-500">正在初始化系统，请稍候...</p>
        </div>
      </div>
    </div>
  );
}
