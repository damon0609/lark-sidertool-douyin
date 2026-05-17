import React, { useState, useEffect, useRef, useCallback } from 'react';
import { setDouyinCookies, getCookieStatus, refreshCookie, clearCookie } from '../core/douyinServer';
import { encrypt, decrypt } from '../utils/crypto';

const COOKIES_STORAGE_KEY = 'douyin_cookies_encrypted';
const STATUS_CHECK_INTERVAL = 300000;

type CookieStatus = 'idle' | 'valid' | 'not_initialized' | 'error' | 'refreshing';

interface CookieStatusData {
  initialized: boolean;
  env_configured: boolean;
  source: 'memory' | 'environment' | 'none';
  set_time: string | null;
  cookies_preview: string;
}

export default function CookiesModule() {
  const [cookies, setCookies] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [cookieStatus, setCookieStatus] = useState<CookieStatus>('idle');
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  const [cookieInfo, setCookieInfo] = useState<CookieStatusData | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadEncryptedCookie = useCallback(async () => {
    try {
      const encryptedData = localStorage.getItem(COOKIES_STORAGE_KEY);
      if (encryptedData) {
        const decrypted = await decrypt(encryptedData);
        if (decrypted) {
          setCookies(decrypted);
          return decrypted;
        }
      }
      return '';
    } catch (error) {
      console.error('加载加密Cookie失败:', error);
      return '';
    }
  }, []);

  const saveEncryptedCookie = useCallback(async (cookieValue: string) => {
    try {
      if (cookieValue.trim()) {
        const encrypted = await encrypt(cookieValue);
        localStorage.setItem(COOKIES_STORAGE_KEY, encrypted);
      } else {
        localStorage.removeItem(COOKIES_STORAGE_KEY);
      }
    } catch (error) {
      console.error('保存加密Cookie失败:', error);
    }
  }, []);

  useEffect(() => {
    loadEncryptedCookie();
  }, [loadEncryptedCookie]);

  const checkCookieValidity = useCallback(async () => {
    if (!cookies.trim()) return;

    try {
      const status = await getCookieStatus();
      
      setLastCheckTime(new Date());
      setCookieInfo(status);
      
      if (status.initialized) {
        setCookieStatus('valid');
        
        const sourceText = status.source === 'memory' ? '内存' : 
                          status.source === 'environment' ? '环境变量' : '未知';
        let statusMessage = `✅ Cookie 已初始化 (${sourceText})`;
        
        if (status.cookies_preview && status.cookies_preview !== '已设置(无sessionid)') {
          statusMessage += ` - ${status.cookies_preview}`;
        }
        
        if (status.set_time) {
          const setTime = new Date(status.set_time);
          const timeAgo = getTimeAgo(setTime);
          statusMessage += `\n⏰ 设置于 ${timeAgo}`;
        }
        
        setMessage(statusMessage);
      } else {
        setCookieStatus('not_initialized');
        setMessage('⚠️ Cookie 未初始化，正在尝试重新设置...');
        
        const savedCookie = await loadEncryptedCookie();
        if (savedCookie) {
          await handleAutoRefresh(savedCookie);
        }
      }
    } catch (error) {
      console.error('检查Cookie状态失败:', error);
      setCookieStatus('error');
      
      if (error instanceof Error && error.message.includes('未配置Cookie')) {
        setMessage('❌ 服务器端未配置Cookie，请重新设置');
      } else {
        setMessage(`❌ 无法验证Cookie状态: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }
  }, [cookies, loadEncryptedCookie]);

  const handleAutoRefresh = async (cookieValue: string) => {
    if (!cookieValue.trim()) return;

    try {
      setCookieStatus('refreshing');
      setIsLoading(true);
      setMessage('🔄 正在自动刷新 Cookie...');
      
      const result = await refreshCookie(cookieValue);
      
      if (result.success) {
        setMessage('✅ Cookie 刷新成功');
        setCookieStatus('valid');
        
        setTimeout(() => checkCookieValidity(), 2000);
      } else {
        setMessage(`❌ 刷新失败: ${result.message}`);
        setCookieStatus('error');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '刷新失败';
      console.error('自动刷新Cookie失败:', error);
      setMessage(`❌ 自动刷新失败: ${errorMsg}`);
      setCookieStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (cookies.trim()) {
      checkCookieValidity();
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      intervalRef.current = setInterval(checkCookieValidity, STATUS_CHECK_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [cookies, checkCookieValidity]);

  const handleCookiesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCookies(value);
    
    await saveEncryptedCookie(value);

    if (value.trim()) {
      setIsLoading(true);
      setMessage('');
      setCookieStatus('idle');
      
      try {
        const result = await setDouyinCookies(value);
        setMessage(result.message || '✅ Cookies 设置成功');
        setCookieStatus('valid');
        
        setTimeout(() => checkCookieValidity(), 1000);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '设置失败';
        alert(`设置 Cookies 失败: ${errorMsg}`);
        setMessage(`❌ ${errorMsg}`);
        setCookieStatus('error');
      } finally {
        setIsLoading(false);
      }
    } else {
      setMessage('');
      setCookieStatus('idle');
    }
  };

  const handleManualRefresh = async () => {
    if (!cookies.trim()) {
      alert('请先设置 Cookie');
      return;
    }
    
    await handleAutoRefresh(cookies);
  };

  const handleClearCookie = async () => {
    try {
      await clearCookie();
      setCookies('');
      await saveEncryptedCookie('');
      setMessage('🗑️ Cookie 已清除');
      setCookieStatus('idle');
      setLastCheckTime(null);
      setCookieInfo(null);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } catch (error) {
      console.error('清除Cookie失败:', error);
      setMessage(`❌ 清除失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const getStatusColor = () => {
    switch (cookieStatus) {
      case 'valid': return 'text-green-500';
      case 'not_initialized': return 'text-yellow-500';
      case 'error': return 'text-red-500';
      case 'refreshing': return 'text-blue-500';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (cookieStatus) {
      case 'valid': return '✅';
      case 'not_initialized': return '⚠️';
      case 'error': return '❌';
      case 'refreshing': return '🔄';
      default: return '';
    }
  };

  const getStatusText = () => {
    switch (cookieStatus) {
      case 'idle': return '未设置';
      case 'valid': return '已初始化';
      case 'not_initialized': return '未初始化';
      case 'refreshing': return '刷新中...';
      case 'error': return '错误';
      default: return cookieStatus;
    }
  };

  const getSourceColor = () => {
    if (!cookieInfo) return 'text-gray-400';
    switch (cookieInfo.source) {
      case 'memory': return 'text-blue-500';
      case 'environment': return 'text-purple-500';
      default: return 'text-gray-400';
    }
  };

  const getSourceText = () => {
    if (!cookieInfo) return '';
    switch (cookieInfo.source) {
      case 'memory': return '💾 内存存储';
      case 'environment': return '🔧 环境变量';
      default: return '❓ 未知来源';
    }
  };

  return (
    <div className="bg-[#f0f4f8] border-2 border-black rounded-xl p-4 mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-2xl font-bold text-gray-800">🍪 Cookies</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusIcon()} {getStatusText()}
          </span>
          
          {cookieInfo && cookieInfo.source !== 'none' && (
            <span className={`text-xs px-2 py-1 rounded-full bg-gray-200 ${getSourceColor()} font-medium`}>
              {getSourceText()}
            </span>
          )}
          
          {lastCheckTime && (
            <span className="text-xs text-gray-400">
              上次检查: {lastCheckTime.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-2">
        <input
          type="password"
          value={cookies}
          onChange={handleCookiesChange}
          placeholder="请输入抖音Cookies..."
          disabled={isLoading}
          className="flex-1 bg-white border-2 border-black rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all disabled:bg-gray-200 font-mono text-sm"
        />
        <button
          onClick={handleManualRefresh}
          disabled={!cookies.trim() || isLoading || cookieStatus === 'refreshing'}
          className="px-4 py-2 bg-blue-500 text-white border-2 border-black rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all font-medium"
        >
          🔄 刷新
        </button>
        <button
          onClick={handleClearCookie}
          disabled={!cookies.trim() || isLoading}
          className="px-4 py-2 bg-red-500 text-white border-2 border-black rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all font-medium"
        >
          🗑️ 清除
        </button>
      </div>

      {message && (
        <div className={`text-sm mt-1 p-2 rounded-lg ${getStatusColor()} bg-opacity-10 whitespace-pre-line`}>
          {message}
        </div>
      )}

      {isLoading && (
        <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
          <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          <span>处理中...</span>
        </div>
      )}

      {cookieInfo && cookieInfo.initialized && (
        <div className="mt-3 pt-3 border-t border-gray-300 text-xs space-y-1">
          <div className="flex justify-between items-center text-gray-600">
            <span>📊 状态详情:</span>
            <span className="font-mono">{cookieInfo.cookies_preview || '无预览'}</span>
          </div>
          
          {cookieInfo.set_time && (
            <div className="flex justify-between items-center text-gray-600">
              <span>⏰ 设置时间:</span>
              <span>{new Date(cookieInfo.set_time).toLocaleString()}</span>
            </div>
          )}
          
          <div className="flex justify-between items-center text-gray-600">
            <span>🔐 环境变量:</span>
            <span className={cookieInfo.env_configured ? 'text-green-600' : 'text-gray-400'}>
              {cookieInfo.env_configured ? '✅ 已配置' : '❌ 未配置'}
            </span>
          </div>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-300 text-xs text-gray-500 space-y-1">
        <p>🔒 Cookie 已加密存储到本地浏览器</p>
        <p>⏱️ 每 5 分钟自动检测状态</p>
        <p>🔄 检测到未初始化时自动尝试恢复</p>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}秒前`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}
