import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 80;

app.use(cors());

// Proxy requests to Archive.org
app.use(
  '/proxy/archive',
  createProxyMiddleware({
    target: 'https://archive.org',
    changeOrigin: true,
    pathRewrite: {
      '^/proxy/archive': '',
    },
    followRedirects: true, // This tells the proxy to follow 301/302 redirects automatically
    onProxyRes: function (proxyRes, req, res) {
      // Ensure CORS headers are sent back to the browser
      proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    }
  })
);

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
