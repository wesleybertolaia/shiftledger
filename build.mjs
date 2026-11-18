import { cp, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';

await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await build({
  entryPoints: ['main.js'],
  outfile: 'dist/app.js',
  bundle: true,
  format: 'esm',
  minify: true,
  target: ['es2022'],
  define: { 'process.env.NODE_ENV': '"production"' },
});
