import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const [port = '8787', basePath = '/'] = process.argv.slice(2);
const types = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
};
const root = new URL('../docs/', import.meta.url);

createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const filename = pathname.slice(basePath.length) || 'index.html';
  const asset = /^[\w-]+\.(html|css|js)$/.exec(filename);

  if (!pathname.startsWith(basePath) || !asset) {
    response.writeHead(404).end('Not found');
    return;
  }

  try {
    const file = await readFile(new URL(filename, root));
    response.writeHead(200, { 'Content-Type': types[asset[1]], 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : file);
  } catch (error) {
    if (error.code === 'ENOENT') response.writeHead(404).end('Not found');
    else response.writeHead(500).end('Could not read asset');
  }
}).listen(Number(port), '127.0.0.1', () => {
  console.log(`http://127.0.0.1:${port}${basePath}`);
});
