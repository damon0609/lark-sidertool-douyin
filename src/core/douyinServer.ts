const API_BASE_URL = 'http://www.douyin-spider.damonai.top/douyin-spider';

interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  error?: string;
  code?: number;
  data?: T;
}

interface HealthCheckResponse {
  status: 'ok' | 'error';
  auth_initialized: boolean;
  cookie_set_at: string | null;
}

interface CookieStatusResponse {
  initialized: boolean;
  env_configured: boolean;
  source: 'memory' | 'environment' | 'none';
  set_time: string | null;
  cookies_preview: string;
}

interface SetCookieResponse {
  success: boolean;
  message: string;
}

interface ClearCookieResponse {
  success: boolean;
  message: string;
}

interface SearchRequest {
  query: string;
  sort_type?: string;
  publish_time?: string;
  count?: string;
  filter_duration?: string;
  search_range?: string;
  content_type?: string;
}

interface VideoUrlRequest {
  url: string;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 502) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error === 'proxy_error') {
          throw new Error(`代理错误 (${errorData.code}): ${errorData.message}`);
        }
      }
      
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 401 && errorData.error?.includes('DY_COOKIES')) {
        throw new Error('未配置Cookie，请先设置抖音Cookie');
      }
      
      throw new Error(errorData.message || errorData.error || `Request failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('请求超时: API服务可能不可用或响应过慢');
      }
      
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes('econnreset')) {
        throw new Error('连接被重置: API服务器可能过载或暂时不可用，请稍后重试');
      }
      if (errorMessage.includes('econnrefused')) {
        throw new Error('连接被拒绝: API服务器未启动或网络不通');
      }
      if (errorMessage.includes('enotfound')) {
        throw new Error('DNS解析失败: 无法找到API服务器地址');
      }
      if (errorMessage.includes('failed to fetch') || errorMessage.includes('networkerror')) {
        throw new Error('网络请求失败: 请检查网络连接或API服务状态');
      }
      
      throw error;
    }
    throw new Error('未知错误');
  }
}

export async function setDouyinCookies(cookies: string): Promise<SetCookieResponse> {
  if (!cookies || !cookies.trim()) {
    throw new Error('Cookies不能为空');
  }
  
  const result = await request<SetCookieResponse>(`${API_BASE_URL}/auth/set-cookie`, {
    method: 'POST',
    body: JSON.stringify({ cookies: cookies.trim() }),
  });
  
  return result;
}

export async function refreshCookie(cookies: string): Promise<SetCookieResponse> {
  if (!cookies || !cookies.trim()) {
    throw new Error('Cookies不能为空');
  }
  const result = await request<SetCookieResponse>(`${API_BASE_URL}/auth/refresh-cookie`, {
    method: 'POST',
    body: JSON.stringify({ cookies: cookies.trim() }),
  });
  
  return result;
}

export async function clearCookie(): Promise<ClearCookieResponse> {
  return request<ClearCookieResponse>(`${API_BASE_URL}/auth/clear-cookie`, {
    method: 'POST',
  });
}

export async function getCookieStatus(): Promise<CookieStatusResponse> {
  return request<CookieStatusResponse>(`${API_BASE_URL}/auth/status`);
}

export async function healthCheck(): Promise<HealthCheckResponse> {
  return request<HealthCheckResponse>(`${API_BASE_URL}/health`);
}

export async function getCollectList(): Promise<any> {
  return request(`${API_BASE_URL}/collect/list`);
}

export async function searchVideos(params: SearchRequest): Promise<any> {
  return request(`${API_BASE_URL}/search`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function searchVideosBatch(params: SearchRequest): Promise<any> {
  return request(`${API_BASE_URL}/search/batch`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getDouyinUserInfo(userUrl: string): Promise<any> {
  if (!userUrl) {
    throw new Error('用户URL不能为空');
  }
  return request(`${API_BASE_URL}/user/info`, {
    method: 'POST',
    body: JSON.stringify({ userUrl }),
  });
}

export async function getDouyinUserWorks(userUrl: string): Promise<any> {
  if (!userUrl) {
    throw new Error('用户URL不能为空');
  }
  return request(`${API_BASE_URL}/user/works`, {
    method: 'POST',
    body: JSON.stringify({ userUrl }),
  });
}

export async function getDouyinWorkInfo(workUrl: string): Promise<any> {
  if (!workUrl) {
    throw new Error('作品URL不能为空');
  }
  return request(`${API_BASE_URL}/video/detail`, {
    method: 'POST',
    body: JSON.stringify({ url: workUrl }),
  });
}

export async function getUserInfo(userUrl: string): Promise<any> {
  if (!userUrl) {
    throw new Error('用户主页URL不能为空');
  }
  return request(`${API_BASE_URL}/user/info`, {
    method: 'POST',
    body: JSON.stringify({ url: userUrl }),
  });
}

export async function getComments(videoUrl: string): Promise<any> {
  if (!videoUrl) {
    throw new Error('视频URL不能为空');
  }
  return request(`${API_BASE_URL}/comments`, {
    method: 'POST',
    body: JSON.stringify({ videoUrl }),
  });
}

export async function getAllComments(videoUrl: string): Promise<any> {
  if (!videoUrl) {
    throw new Error('视频URL不能为空');
  }
  return request(`${API_BASE_URL}/comments/all`, {
    method: 'POST',
    body: JSON.stringify({ videoUrl }),
  });
}

export async function downloadVideo(url: string, fileName: string): Promise<File> {
  if (!url) {
    throw new Error('视频URL不能为空');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`下载视频失败: ${response.status}`);
    }

    const blob = await response.blob();
    return new File([blob], fileName, { type: blob.type });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('下载超时');
    }
    throw error;
  }
}

interface VideoDownloadResponse {
  success: boolean;
  data?: {
    base64: string;
    file_name: string;
    mime_type: string;
    size: number;
  };
  error?: string;
  base64?: string;
  size_bytes?: number;
  size_mb?: number;
  file_name?: string;
  mime_type?: string;
}

export async function downloadVideoToBase64(videoUrl: string): Promise<VideoDownloadResponse> {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(2, 8).toUpperCase();

  console.group(`🎬 [${requestId}] downloadVideoToBase64 开始`);
  console.log(`   📤 请求URL: ${videoUrl}`);
  console.log(`   📦 URL长度: ${videoUrl?.length || 0} 字符`);
  console.log(`   ⏰ 开始时间: ${new Date().toLocaleTimeString()}`);

  if (!videoUrl) {
    console.error(`   ❌ [${requestId}] 视频URL为空，终止请求`);
    console.groupEnd();
    throw new Error('视频URL不能为空');
  }

  try {
    const requestUrl = `${API_BASE_URL}/video/download`;
    const requestBody = { url: videoUrl };

    console.log(`   🔗 API端点: POST ${requestUrl}`);
    console.log(`   📋 请求体:`, {
      url: videoUrl.substring(0, 100) + (videoUrl.length > 100 ? '...' : ''),
      _fullLength: videoUrl.length
    });

    const result = await request<VideoDownloadResponse>(requestUrl, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const elapsed = Date.now() - startTime;
    const hasNestedData = result?.success && result?.data?.base64;
    const hasFlatData = result?.success && result?.base64;

    if (hasNestedData || hasFlatData) {
      const data = result.data || {
        base64: result.base64,
        file_name: result.file_name || 'video.mp4',
        mime_type: result.mime_type || 'video/mp4',
        size: result.size_bytes || 0,
      };
      console.log(`   ✅ [${requestId}] 下载成功 (${elapsed}ms)`);
      console.log(`      📁 文件名: ${data.file_name}`);
      console.log(`      📏 文件大小: ${data.size ? (data.size / 1024).toFixed(1) + ' KB' : result.size_mb + ' MB'}`);
      console.log(`      🎨 MIME类型: ${data.mime_type}`);
      console.log(`      🔢 Base64长度: ${data.base64?.length || 0} 字符`);
      if (!result.data && hasFlatData) {
        console.log(`      📝 数据格式: 扁平结构(已自动转换)`);
        (result as any).data = data;
      }
    } else {
      console.warn(`   ⚠️ [${requestId}] 下载返回异常 (${elapsed}ms)`);
      console.warn(`      success: ${result?.success}`);
      console.warn(`      error: ${result?.error || '无错误信息'}`);
      console.warn(`      完整响应:`, result);
    }

    console.groupEnd();
    return result;
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`   ❌ [${requestId}] 下载失败 (${elapsed}ms)`);
    console.error(`      错误类型: ${error instanceof Error ? error.constructor.name : typeof error}`);
    console.error(`      错误消息: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error(`      堆栈跟踪:`, error.stack.split('\n').slice(0, 3));
    }
    console.groupEnd();
    throw error;
  }
}
