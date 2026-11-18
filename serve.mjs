import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const types = { html: 'text/html', css: 'text/css', js: 'text/javascript' };
const port = Number(process.env.PORT || 4173);
createServer(async (request, response) => {
  const route = new URL(request.url, 'http://localhost').pathname;
  const file = route === '/' ? 'index.html' : route.slice(1);
  const type = file.split('.').at(-1);
  if (!/^[\w.-]+$/.test(file) || !Object.hasOwn(types, type)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const content = await readFile(new URL('./dist/' + file, import.meta.url));
    response.writeHead(200, { 'Content-Type': types[type] + '; charset=utf-8' }).end(content);
  } catch {
    response.writeHead(404).end();
  }
}).listen(port, '127.0.0.1', () => console.log('Local: http://localhost:' + port));
