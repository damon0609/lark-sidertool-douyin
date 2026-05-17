import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import http from 'http';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  
  const httpAgent = new http.Agent({
    keepAlive: false,
  });
  
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/douyin-spider': {
          target: 'http://www.douyin-spider.damonai.top',
          changeOrigin: true,
          timeout: 30000,
          proxyTimeout: 30000,
          agent: httpAgent,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Connection': 'close',
          },
          rewrite: (path) => path,
          configure: (proxy, options) => {
            proxy.on('error', (err: NodeJS.ErrnoException, req, res) => {
              console.log('proxy error', err);
              if (!res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'application/json' });
              }
              res.end(JSON.stringify({
                error: 'proxy_error',
                message: err.message,
                code: (err as NodeJS.ErrnoException).code || 'UNKNOWN',
                timestamp: new Date().toISOString()
              }));
            });
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log('Proxying:', req.method, req.url, '->', options.target);
            });
          },
        },
      },
    },
  };
});
