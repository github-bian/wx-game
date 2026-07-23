const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'src/main.js');
const port = Number(process.env.PORT || 4173);

function moduleId(file) {
  return `/${path.relative(root, file).replace(/\\/g, '/')}`;
}

function resolveModule(from, request) {
  const base = path.resolve(path.dirname(from), request);
  return path.extname(base) ? base : `${base}.js`;
}

function collectModules(file, modules) {
  if (modules.has(file)) return;
  const source = fs.readFileSync(file, 'utf8');
  modules.set(file, source);
  const requirePattern = /require\(['"](.+?)['"]\)/g;
  let match;
  while ((match = requirePattern.exec(source))) {
    if (!match[1].startsWith('.')) continue;
    collectModules(resolveModule(file, match[1]), modules);
  }
}

function browserBundle() {
  const modules = new Map();
  collectModules(entry, modules);
  const factories = Array.from(modules.entries()).map(([file, source]) => {
    return `${JSON.stringify(moduleId(file))}: new Function('module', 'exports', 'require', ${JSON.stringify(source)})`;
  }).join(',\n');

  return `
    const factories = {${factories}};
    const cache = {};
    function normalize(value) {
      const parts = [];
      value.split('/').forEach((part) => {
        if (!part || part === '.') return;
        if (part === '..') parts.pop();
        else parts.push(part);
      });
      return '/' + parts.join('/');
    }
    function load(id) {
      if (cache[id]) return cache[id].exports;
      if (!factories[id]) throw new Error('Missing preview module: ' + id);
      const module = { exports: {} };
      cache[id] = module;
      const localRequire = (request) => {
        const base = id.slice(0, id.lastIndexOf('/') + 1);
        const target = normalize(base + request + (request.endsWith('.js') ? '' : '.js'));
        return load(target);
      };
      factories[id](module, module.exports, localRequire);
      return module.exports;
    }
    load('/src/main.js');
  `;
}

function page() {
  return `<!doctype html>
  <html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
    <title>镇夜局：纸门 - 本地预览</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; background: #050706; color: #d8c7a4; font-family: sans-serif; }
      body { display: grid; place-items: center; padding: 18px; }
      main { display: grid; justify-items: center; gap: 10px; }
      canvas { width: min(390px, calc(100vw - 28px)); height: min(694px, calc(100vh - 72px)); box-shadow: 0 24px 80px #000; border: 1px solid #3c2c23; border-radius: 16px; touch-action: none; }
      p { margin: 0; color: #756e61; font-size: 12px; }
    </style>
  </head>
  <body>
    <main>
      <canvas aria-label="游戏画面"></canvas>
      <p>浏览器调试预览 · 点击画面即可操作</p>
    </main>
    <script>
      const previewCanvas = document.querySelector('canvas');
      let touchHandler = null;
      window.wx = {
        createCanvas: () => previewCanvas,
        getWindowInfo: () => ({ windowWidth: 390, windowHeight: 694, pixelRatio: window.devicePixelRatio || 1 }),
        getSystemInfoSync: () => ({ windowWidth: 390, windowHeight: 694, pixelRatio: window.devicePixelRatio || 1 }),
        createWebAudioContext: () => new (window.AudioContext || window.webkitAudioContext)(),
        onTouchStart: (handler) => { touchHandler = handler; },
        onHide: () => {},
        onShow: () => {},
        vibrateShort: () => {},
        vibrateLong: () => {},
        setStorageSync: (key, value) => localStorage.setItem(key, JSON.stringify(value))
      };
      previewCanvas.addEventListener('pointerdown', (event) => {
        if (!touchHandler) return;
        const rect = previewCanvas.getBoundingClientRect();
        touchHandler({ touches: [{
          clientX: (event.clientX - rect.left) / rect.width * 390,
          clientY: (event.clientY - rect.top) / rect.height * 694
        }] });
      });
      ${browserBundle()}
    </script>
  </body>
  </html>`;
}

http.createServer((request, response) => {
  if (request.url === '/' || request.url === '/index.html') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(page());
    return;
  }
  response.writeHead(404);
  response.end('Not found');
}).listen(port, '127.0.0.1', () => {
  console.log(`Preview: http://127.0.0.1:${port}`);
});
