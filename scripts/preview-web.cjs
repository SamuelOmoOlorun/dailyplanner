const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../dist');
const port = 8082;
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error('Run npm.cmd run export:web before starting the preview.');
  process.exit(1);
}

const server = http.createServer((request, response) => {
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405).end();
    return;
  }

  let file;
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  } catch {
    response.writeHead(400).end();
    return;
  }

  if (!file.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end();
    return;
  }

  fs.readFile(file, (error, data) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' || error.code === 'EISDIR' ? 404 : 500).end();
      return;
    }
    response.setHeader('Content-Type', contentTypes[path.extname(file)] || 'application/octet-stream');
    response.writeHead(200).end(request.method === 'HEAD' ? undefined : data);
  });
});

server.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Web preview with SQLite isolation headers: http://127.0.0.1:${port}`);
});
