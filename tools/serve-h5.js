const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../dist/h5');
const port = Number(process.env.PORT || 4173);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png'
};

http.createServer((request, response) => {
  const urlPath = request.url === '/' ? '/index.html' : request.url.split('?')[0];
  const file = path.resolve(root, `.${urlPath}`);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'content-type': mime[path.extname(file)] || 'application/octet-stream',
    'cache-control': 'no-store'
  });
  fs.createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`H5 preview: http://127.0.0.1:${port}`);
});
