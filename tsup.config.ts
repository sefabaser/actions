import { defineConfig } from 'tsup';
import mangleCache from './mangle-cache.json';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: false, 
  clean: true,
  minify: true, 
  treeshake: true,
  target: 'esnext',
  outDir: 'dist',
  esbuildOptions(options) {
    options.charset = 'utf8';
    options.mangleProps = /^_/;
    options.mangleCache = mangleCache;
    options.mangleQuoted = true; 
    options.keepNames = false;
    options.drop = [];
    options.pure = [];
  },
});
